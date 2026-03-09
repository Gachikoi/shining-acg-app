/**
 * 媒体分片上传工具
 *
 * 实现基于 S3 Multipart Upload 语义的客户端上传流程：
 *   PrepareUploadBatch → CreateMultipartUpload → (SignPart → PUT)×N → CompleteMultipartUpload
 *
 * 参考产品需求 6.2.5.4 发布以后
 */
import {
	mediaServiceAbortMultipartUpload,
	mediaServiceCompleteMultipartUpload,
	mediaServiceCreateMultipartUpload,
	mediaServicePrepareUploadBatch,
	mediaServiceSignMultipartPart
} from '$lib/api/sdk.gen';
import type { V1MediaAsset, V1UploadAsset, V1UploadedPart } from '$lib/api/types.gen';

// S3 要求除最后一个分片外每片至少 5 MB
const PART_SIZE_BYTES = 5 * 1024 * 1024;

/** 批次上传进度快照 */
export type UploadProgress = {
	uploadedFiles: number;
	totalFiles: number;
};

/**
 * 批次中止控制器。
 * 持有所有已开启的 multipart 会话的 abort 回调，
 * 调用 abort() 会向服务端发送 AbortMultipartUpload 并标记批次为已中止。
 */
export class UploadAbortController {
	#aborted = false;
	// 每个已开启会话的 abort 回调，key 为 taskId
	readonly #abortFns = new Map<string, () => Promise<void>>();

	get aborted(): boolean {
		return this.#aborted;
	}

	/** 注册一个文件会话的 abort 回调（由 uploadMediaBatch 内部调用）。 */
	registerAbort(taskId: string, fn: () => Promise<void>): void {
		this.#abortFns.set(taskId, fn);
	}

	/** 中止所有正在进行的上传会话。可安全多次调用。 */
	async abort(): Promise<void> {
		if (this.#aborted) return;
		this.#aborted = true;
		// 并发中止所有会话，忽略各自失败以保证全部发送
		await Promise.allSettled([...this.#abortFns.values()].map((fn) => fn()));
	}
}

/** 将 data URL（例如从草稿恢复）转回 File 对象。 */
export async function dataURLToFile(dataURL: string, filename: string): Promise<File> {
	const res = await fetch(dataURL);
	const blob = await res.blob();
	return new File([blob], filename, { type: blob.type });
}

/** 根据 MIME type 判断是否为图片。 */
function isImageMime(mimeType: string): boolean {
	return mimeType.startsWith('image/');
}

/**
 * 上传一批媒体文件，返回可直接传入 postServiceCreatePost.mediaAssets 的 V1MediaAsset 列表。
 *
 * @param files          File 对象数组（图片 / 视频）
 * @param batchId        业务侧幂等批次 ID，同一发布流程内应保持不变（使用 crypto.randomUUID()）
 * @param onProgress     每完成一个文件后触发的进度回调
 * @param abortController  可选，传入后调用 abortController.abort() 可中途取消整批
 * @returns              已上传的 V1MediaAsset 列表（顺序与入参 files 一致）
 */
export async function uploadMediaBatch(
	files: File[],
	batchId: string,
	onProgress: (progress: UploadProgress) => void,
	abortController?: UploadAbortController
): Promise<V1MediaAsset[]> {
	// ── Step 1: 批量准备上传任务 ──────────────────────────────────────
	// 服务端校验参数、固化顺序、分配 assetId / taskId
	const uploadAssets: V1UploadAsset[] = files.map((file) => ({
		// 所有帖子正文媒体均使用 POST_MEDIA 场景
		// TODO(6.2.5.1-1): 封面独立上传时改为 MEDIA_SCENE_POST_COVER 场景
		scene: 'MEDIA_SCENE_POST_MEDIA',
		singleFile: {
			filename: file.name,
			sizeBytes: String(file.size),
			mimeType: file.type
		}
	}));

	const prepareRes = await mediaServicePrepareUploadBatch({
		body: { batchId, assets: uploadAssets },
		throwOnError: true
	});

	const preparedAssets = prepareRes.data!.assets;
	const resultAssets: V1MediaAsset[] = [];

	// ── Step 2-4: 逐文件执行分片上传 ──────────────────────────────────
	for (let i = 0; i < files.length; i++) {
		if (abortController?.aborted) break;

		const file = files[i];
		const preparedAsset = preparedAssets[i];
		// 对于普通图片 / 视频（非 Live Photo），每个 asset 只有一个 task
		const task = preparedAsset.tasks[0];
		if (!task) {
			throw new Error(`Asset ${preparedAsset.assetId} 返回了空 tasks 列表`);
		}

		// 用对象持有会话 ID，方便 abort 闭包通过属性引用（而非变量重新赋值）访问
		const session = { uploadId: '', objectKey: '' };
		let fileAborted = false;

		// 在创建会话之前注册 abort 回调，防止 createMultipartUpload 飞行期间
		// abort() 被调用时 uploadId 尚未赋值导致后端会话泄漏
		abortController?.registerAbort(task.taskId, async () => {
			fileAborted = true;
			if (session.uploadId && session.objectKey) {
				await mediaServiceAbortMultipartUpload({
					body: { taskId: task.taskId, uploadId: session.uploadId, objectKey: session.objectKey },
					throwOnError: false // 网络断开时也要尽力中止，不能抛出阻塞后续逻辑
				});
			}
		});

		if (abortController?.aborted) break;

		// Step 2: 为该文件创建 multipart 会话（对应 S3 CreateMultipartUpload）
		const createRes = await mediaServiceCreateMultipartUpload({
			body: { taskId: task.taskId },
			throwOnError: true
		});

		session.uploadId = createRes.data!.uploadId;
		session.objectKey = createRes.data!.objectKey;

		// 处理竞态：abort() 在 createMultipartUpload 飞行期间被调用，
		// 此时 abort 回调中 uploadId 为 undefined 未能清理后端，需在此补发 Abort
		if (fileAborted || abortController?.aborted) {
			await mediaServiceAbortMultipartUpload({
				body: { taskId: task.taskId, uploadId: session.uploadId, objectKey: session.objectKey },
				throwOnError: false
			});
			break;
		}

		// Step 3: 分片上传
		// 将文件按 PART_SIZE_BYTES（5 MB）切割；最后一片可以小于 5 MB
		const totalParts = Math.ceil(file.size / PART_SIZE_BYTES);
		const uploadedParts: V1UploadedPart[] = [];

		for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
			if (fileAborted || abortController?.aborted) break;

			const start = (partNumber - 1) * PART_SIZE_BYTES;
			const end = Math.min(start + PART_SIZE_BYTES, file.size);
			const chunk = file.slice(start, end);

			// 为该分片获取预签名 PUT URL（S3 签名有时效限制，每片单独请求）
			const signRes = await mediaServiceSignMultipartPart({
				body: {
					taskId: task.taskId,
					uploadId: session.uploadId,
					partNumber,
					objectKey: session.objectKey
				},
				throwOnError: true
			});

			const { uploadUrl, requiredHeaders } = signRes.data!;

			// 直接向 S3 PUT 分片数据，不经过业务后端
			const putRes = await fetch(uploadUrl, {
				method: 'PUT',
				body: chunk,
				headers: requiredHeaders
			});

			if (!putRes.ok) {
				throw new Error(
					`分片 ${partNumber}/${totalParts} 上传失败：${putRes.status} ${putRes.statusText}`
				);
			}

			// S3 在响应头 ETag 中返回分片摘要，Complete 时需要原样回传
			const etag = putRes.headers.get('ETag') ?? '';
			uploadedParts.push({ partNumber, etag, sizeBytes: String(chunk.size) });
		}

		if (fileAborted || abortController?.aborted) break;

		// Step 4: 通知服务端合并分片（对应 S3 CompleteMultipartUpload）
		const completeRes = await mediaServiceCompleteMultipartUpload({
			body: {
				taskId: task.taskId,
				uploadId: session.uploadId,
				parts: uploadedParts,
				objectKey: session.objectKey
			},
			throwOnError: true
		});

		const mediaFileInfo = completeRes.data!.media;

		// 构造 V1MediaAsset 供 CreatePost 使用
		// status 为 PROCESSING 是正常状态——服务端可能仍在转码或后处理
		resultAssets.push({
			assetId: preparedAsset.assetId,
			type: isImageMime(file.type) ? 'MEDIA_TYPE_IMAGE' : 'MEDIA_TYPE_VIDEO',
			scene: preparedAsset.scene,
			status: 'MEDIA_STATUS_PROCESSING',
			orderIndex: preparedAsset.orderIndex,
			single: mediaFileInfo.file
		});

		onProgress({ uploadedFiles: i + 1, totalFiles: files.length });
	}

	return resultAssets;
}
