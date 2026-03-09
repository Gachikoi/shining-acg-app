import type { AwsS3MultipartOptions } from '@uppy/aws-s3';
import AwsS3 from '@uppy/aws-s3';
import Compressor from '@uppy/compressor';
import Uppy, { type UploadResult } from '@uppy/core';

import {
	mediaServiceAbortMultipartUpload,
	mediaServiceCompleteMultipartUpload,
	mediaServiceCreateMultipartUpload,
	mediaServiceGetBatchMedia,
	mediaServiceListUploadedParts,
	mediaServicePrepareUploadBatch,
	mediaServiceSignMultipartPart,
	type V1MediaAsset,
	type V1MediaScene,
	type V1UploadFile,
	type V1UploadAsset
} from '../../api';
// import { mediaClient } from '../realtime/media';
import type {
	// BatchProgressEvent,
	CompiledBatchInput,
	CreateMediaUploaderOptions,
	FlatUploadFile,
	MediaUploader,
	MediaUploadMeta,
	PrepareUploadParams,
	UploadBody
} from './types';

/**
 * 将单个 File 对象转换为 proto UploadFile payload。
 * crop_cover 已提升到 UploadAsset 层，此函数不再接收该参数。
 *
 * @param file - 原始文件对象
 * @param fileHash - 可选文件哈希，便于后端去重
 * @returns proto V1UploadFile 请求体
 */
function toUploadFilePayload(file: File, fileHash?: string): V1UploadFile {
	return {
		filename: file.name,
		sizeBytes: String(file.size),
		mimeType: file.type,
		fileHash: fileHash
	};
}

/**
 * 将业务层 PrepareUploadParams 编译为 proto 请求体与本地文件列表。
 * crop_cover 从 asset 层读取后直接写入 V1UploadAsset，不再经由 UploadFile 传递。
 *
 * @param assets - 业务层媒体元素数组
 * @returns 包含 proto 请求体与本地文件列表的编译结果
 */
function compileBatchInput(assets: PrepareUploadParams): CompiledBatchInput {
	const requestAssets: V1UploadAsset[] = [];
	const files: FlatUploadFile[] = [];

	for (const asset of assets) {
		if (asset.kind === 'single') {
			const localFileId = crypto.randomUUID();
			requestAssets.push({
				scene: asset.scene,
				singleFile: toUploadFilePayload(asset.single.file, asset.single.fileHash),
				// crop_cover 为元素级属性，直接挂载在 UploadAsset 上
				cropCover: asset.cropCover
			});
			files.push({
				localFileId,
				file: asset.single.file,
				scene: asset.scene,
				role: 'single'
			});
			continue;
		}

		const imageLocalFileId = crypto.randomUUID();
		const videoLocalFileId = crypto.randomUUID();
		requestAssets.push({
			scene: asset.scene,
			livePhotoPair: {
				imageFile: toUploadFilePayload(asset.livePhoto.image.file, asset.livePhoto.image.fileHash),
				videoFile: toUploadFilePayload(asset.livePhoto.video.file, asset.livePhoto.video.fileHash)
			},
			// Live Photo 的 cropCover 作用于图片轨，由后端 processImage 读取 asset.CropCover 执行裁剪
			cropCover: asset.cropCover
		});
		files.push({
			localFileId: imageLocalFileId,
			file: asset.livePhoto.image.file,
			scene: asset.scene,
			role: 'live_photo_image'
		});
		files.push({
			localFileId: videoLocalFileId,
			file: asset.livePhoto.video.file,
			scene: asset.scene,
			role: 'live_photo_video'
		});
	}

	return {
		requestAssets,
		files
	};
}

export function createMediaUploader(options: CreateMediaUploaderOptions = {}): MediaUploader {
	const batchSockets = new Map<string, () => void>();

	const baseRequestOptions = async () => {
		const requestOptions: { baseURL?: string; headers?: Record<string, string> } = {};
		if (options.baseUrl) {
			requestOptions.baseURL = options.baseUrl;
		}
		const headers = await options.getHeaders?.();
		if (headers && Object.keys(headers).length > 0) {
			requestOptions.headers = headers;
		}
		return requestOptions;
	};

	const uppy = new Uppy<MediaUploadMeta, UploadBody>({
		autoProceed: false,
		...options.uppyOptions
	});

	const awsS3Options = {
		// cloudflare 单次上传限制为 100MB，由于我们最大上传文件 2 GB，因此分片上传 1 片肯定不会超过 100 MB，不用担心。
		getChunkSize: (file) => {
			const minPartSize = 10 * 1024 * 1024;
			const maxPartCount = 10000;
			if (!file.size) {
				return minPartSize;
			}
			const partSize = Math.ceil(file.size / maxPartCount);
			return Math.max(partSize, minPartSize);
		},
		createMultipartUpload: async (file) => {
			const taskId = file.meta.task_id;
			const response = await mediaServiceCreateMultipartUpload<true>({
				...(await baseRequestOptions()),
				body: { taskId: taskId }
			});
			if (!response.data.uploadId || !response.data.objectKey) {
				throw new Error(`创建分片上传无效：task_id=${taskId}`);
			}
			return {
				uploadId: response.data.uploadId,
				key: response.data.objectKey
			};
		},
		signPart: async (file, { uploadId, key, partNumber, signal }) => {
			const taskId = file.meta.task_id;
			const response = await mediaServiceSignMultipartPart<true>({
				...(await baseRequestOptions()),
				body: {
					taskId: taskId,
					uploadId: uploadId,
					partNumber: partNumber,
					objectKey: key
				},
				signal
			});
			if (!response.data.uploadUrl) {
				throw new Error(`签名分片上传无效：task_id=${taskId}`);
			}
			return {
				method: 'PUT',
				url: response.data.uploadUrl,
				headers: response.data.requiredHeaders ?? {}
			};
		},
		listParts: async (file, { uploadId, key }) => {
			if (!uploadId) {
				throw new Error(`listParts 缺少 uploadId: file_id=${file.id}`);
			}
			const taskId = file.meta.task_id;
			const response = await mediaServiceListUploadedParts<true>({
				...(await baseRequestOptions()),
				query: {
					taskId: taskId,
					uploadId: uploadId,
					objectKey: key
				}
			});
			return (response.data.parts ?? []).map((part) => ({
				PartNumber: part.partNumber,
				ETag: part.etag
			}));
		},
		completeMultipartUpload: async (file, { uploadId, key, parts }) => {
			const taskId = file.meta.task_id;
			const response = await mediaServiceCompleteMultipartUpload<true>({
				...(await baseRequestOptions()),
				body: {
					taskId: taskId,
					uploadId: uploadId,
					objectKey: key,
					parts: parts.map((part) => ({
						partNumber: part.PartNumber || 0,
						etag: part.ETag || '',
						sizeBytes: `${part.Size || 0}`
					}))
				}
			});
			const media = response.data.media?.file;
			if (!media) {
				throw new Error(`completeMultipartUpload 响应错误：task_id=${taskId}`);
			}
			return {
				location: media.url ?? ''
			};
		},
		abortMultipartUpload: async (file, { uploadId, key }) => {
			if (!uploadId) {
				throw new Error(`abortMultipartUpload 缺少 uploadId: file_id=${file.id}`);
			}
			const taskId = file.meta.task_id;
			await mediaServiceAbortMultipartUpload<true>({
				...(await baseRequestOptions()),
				body: {
					taskId,
					uploadId,
					objectKey: key
				}
			});
		},
		...options.awsS3Options,
		shouldUseMultipart: true
	} as AwsS3MultipartOptions<MediaUploadMeta, UploadBody>;

	uppy
		.use(AwsS3<MediaUploadMeta, UploadBody>, awsS3Options)
		.use(Compressor, { checkOrientation: false });

	const upload = async (params: PrepareUploadParams): Promise<string> => {
		// 每次上传前清理掉 uppy 中的残留文件，避免对新上传批次造成干扰
		uppy.clear();

		if (!params.length) {
			throw new Error('上传批次中没有媒体元素');
		}

		// 不允许业务侧自行生成 batchId，确保 batchId 的唯一性（后端依赖 batchId 进行批次级别的进度推送和批量媒体查询）
		const batchId = crypto.randomUUID();

		const compiled = compileBatchInput(params);
		const response = await mediaServicePrepareUploadBatch<true>({
			...(await baseRequestOptions()),
			body: {
				batchId: batchId,
				assets: compiled.requestAssets
			}
		});
		const preparedAssets = response.data.assets ?? [];

		const preparedFiles: Array<{ taskId: string; assetId?: string; scene?: V1MediaScene }> = [];
		for (const asset of preparedAssets) {
			for (const task of asset.tasks ?? []) {
				if (!task.taskId) {
					continue;
				}
				preparedFiles.push({
					taskId: task.taskId,
					assetId: asset.assetId,
					scene: asset.scene
				});
			}
		}

		if (preparedFiles.length !== compiled.files.length) {
			throw new Error(
				`PrepareUploadBatch 返回任务数异常: expected=${compiled.files.length}, actual=${preparedFiles.length}`
			);
		}

		for (let i = 0; i < compiled.files.length; i++) {
			const mediaFile = compiled.files[i];
			const prepared = preparedFiles[i];

			uppy.addFile({
				id: mediaFile.localFileId,
				name: mediaFile.file.name,
				type: mediaFile.file.type,
				data: mediaFile.file,
				meta: {
					task_id: prepared.taskId,
					asset_id: prepared.assetId,
					scene: prepared.scene ?? mediaFile.scene
				}
			});
		}

		return batchId;
	};

	const getBatchMedia = async (batchId: string): Promise<V1MediaAsset[]> => {
		const response = await mediaServiceGetBatchMedia<true>({
			...(await baseRequestOptions()),
			path: {
				batchId: batchId
			}
		});
		return response.data.mediaAssets ?? [];
	};

	const pauseAll = (): void => {
		uppy.pauseAll();
	};

	const resumeAll = (): void => {
		uppy.resumeAll();
	};

	const retryAll = (): Promise<UploadResult<MediaUploadMeta, UploadBody> | undefined> =>
		uppy.retryAll();

	const cancelAll = (): void => {
		uppy.cancelAll();
	};

	const subscribeBatchProgress = (
		batchId: string
		// listener: (event: BatchProgressEvent) => void
	): (() => void) => {
		const existingUnsubscribe = batchSockets.get(batchId);
		if (existingUnsubscribe) {
			existingUnsubscribe();
			batchSockets.delete(batchId);
		}

		// const unsubscribe = mediaClient.subscribe(
		// 	{
		// 		onProgress: (event) => {
		// 			if (!event.batch_id) {
		// 				return;
		// 			}
		// 			listener(event);
		// 			if (
		// 				event.stage === 'PROGRESS_STAGE_COMPLETED' ||
		// 				event.stage === 'PROGRESS_STAGE_FAILED'
		// 			) {
		// 				unsubscribe();
		// 				batchSockets.delete(batchId);
		// 			}
		// 		},
		// 		onClose: () => {
		// 			batchSockets.delete(batchId);
		// 		}
		// 	},
		// 	[batchId]
		// );
		// batchSockets.set(batchId, unsubscribe);

		return () => {
			// unsubscribe();
			batchSockets.delete(batchId);
		};
	};

	const destroy = () => {
		for (const unsubscribe of batchSockets.values()) {
			unsubscribe();
		}
		batchSockets.clear();
		uppy.destroy();
	};

	const clear = () => {
		for (const unsubscribe of batchSockets.values()) {
			unsubscribe();
		}
		batchSockets.clear();
		uppy.clear();
	};

	return {
		upload,
		pauseAll,
		resumeAll,
		retryAll,
		cancelAll,
		getBatchMedia,
		subscribeBatchProgress,
		destroy,
		clear,
		uppy // TODO 测试完去掉
	};
}
