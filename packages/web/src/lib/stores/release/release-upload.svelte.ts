/**
 * 发布页媒体上传与发布提交：Uppy 生命周期、进度与失败重试，CreatePost 由页面注入回调完成。
 * 与路由生命周期对齐：onMount 调用 init()，onDestroy 调用 destroy()。
 */
import { toast } from 'svelte-sonner';
import { TOAST_MESSAGES } from '$lib/constants/toast-messages';
import type { V1MediaAsset } from '$lib/api/types.gen';
import { createMediaUploader } from '$lib/modules/media-uploader';
import type { MediaUploader } from '$lib/modules/media-uploader';
import { draftItemsToPrepareParams } from '$lib/modules/release-media';
import { formatUploadError } from '$lib/utils/format-upload-error';
import type { DraftMediaItem } from './release-draft.js';

/** `createReleaseUploadController` 的配置：草稿来源与发布成功后的业务回调 */
export type CreateReleaseUploadControllerOptions = {
	/** 当前待上传的本地草稿媒体项 */
	getDraftItems: () => DraftMediaItem[];
	/**
	 * 上传完成（或无媒体跳过上传）后由页面调用 CreatePost 等
	 *
	 * @param mediaAssets - 服务端媒体资源；无上传时为空数组
	 * @param batchId - 上传批次 id；无媒体时为空串
	 */
	completePublish: (mediaAssets: V1MediaAsset[], batchId: string) => Promise<void>;
};

/**
 * 创建发布上传控制器：Prepare 批次、Uppy 上传、失败重试与取消，不直接依赖页面 `$state`。
 *
 * @param options - 草稿 getter 与发布回调
 * @returns `init`/`destroy` 与 `submit`/`retry` 等，及上传态 getter
 */
export function createReleaseUploadController(options: CreateReleaseUploadControllerOptions) {
	let mediaUploader = $state<MediaUploader | null>(null);
	let isUploading = $state(false);
	let uploadProgress = $state<{
		uploadedFiles: number;
		totalFiles: number;
		percent?: number;
	}>({
		uploadedFiles: 0,
		totalFiles: 0
	});
	let uploadCancelled = $state(false);
	let hasUploadError = $state(false);
	let currentBatchId = $state<string | null>(null);

	/**
	 * 实例化 Uppy 上传器；每个发布页生命周期内调用一次（如 `onMount`）
	 */
	function init(): void {
		mediaUploader = createMediaUploader();
	}

	/**
	 * 销毁 Uppy 实例并清空引用；须在回收本地媒体 Blob URL **之前**调用
	 */
	function destroy(): void {
		mediaUploader?.destroy();
		mediaUploader = null;
	}

	/**
	 * 开始一次完整发布：无媒体则直接 `completePublish`；否则先 `upload` 批次再 `uppy.upload()`
	 */
	async function submit(): Promise<void> {
		hasUploadError = false;
		currentBatchId = null;
		const cachedMediaItems = options.getDraftItems();

		if (cachedMediaItems.length === 0) {
			await options.completePublish([], '');
			return;
		}

		const uploader = mediaUploader;
		if (!uploader) {
			toast.error(TOAST_MESSAGES.UPLOAD_ERROR_RETRY);
			return;
		}

		const params = draftItemsToPrepareParams(cachedMediaItems, 'MEDIA_SCENE_POST_MEDIA');
		const totalFiles = params.reduce((sum, p) => sum + (p.kind === 'single' ? 1 : 2), 0);

		isUploading = true;
		uploadCancelled = false;
		uploadProgress = { uploadedFiles: 0, totalFiles };

		let completedCount = 0;
		/** Uppy 单文件上传成功：递增已完成数以更新底栏进度 */
		const handleUploadSuccess = () => {
			completedCount += 1;
			uploadProgress = { uploadedFiles: completedCount, totalFiles };
		};

		/**
		 * Uppy 总进度回调
		 *
		 * @param percent - 0–100 整体上传进度
		 */
		const handleProgress = (percent: number) => {
			uploadProgress = { ...uploadProgress, percent };
		};

		try {
			const batchId = await uploader.upload(params);
			currentBatchId = batchId;
			if (uploadCancelled) return;

			uploader.uppy.on('progress', handleProgress);
			uploader.uppy.on('upload-success', handleUploadSuccess);

			let result;
			try {
				result = await uploader.uppy.upload();
			} finally {
				uploader.uppy.off('progress', handleProgress);
				uploader.uppy.off('upload-success', handleUploadSuccess);
			}

			if (uploadCancelled) return;

			// uppy.upload() 遇部分失败不抛异常，须显式看 failed
			if (result?.failed && result.failed.length > 0) {
				hasUploadError = true;
				toast.error(TOAST_MESSAGES.UPLOAD_PARTIAL_FAILED);
				return;
			}

			const mediaAssets = await uploader.getBatchMedia(batchId);
			await options.completePublish(mediaAssets, batchId);
		} catch (error) {
			if (!uploadCancelled) {
				toast.error(formatUploadError(error) || TOAST_MESSAGES.UPLOAD_ERROR_RETRY);
			}
		} finally {
			// 仍有失败待重试时保持 uploading，底栏展示重试/删失败项
			if (!hasUploadError) {
				isUploading = false;
			}
		}
	}

	/**
	 * 在上传部分失败且 `hasUploadError` 时，重试队列中失败文件；全部成功后调用 `completePublish`
	 */
	async function retry(): Promise<void> {
		const uploader = mediaUploader;
		if (!uploader || !hasUploadError || !currentBatchId) return;
		hasUploadError = false;
		try {
			const result = await uploader.retryAll();
			if (result?.failed && result.failed.length > 0) {
				hasUploadError = true;
				toast.error(
					formatUploadError(result.failed[0]?.error) || TOAST_MESSAGES.UPLOAD_ERROR_RETRY
				);
				return;
			}
			const mediaAssets = await uploader.getBatchMedia(currentBatchId);
			await options.completePublish(mediaAssets, currentBatchId);
		} catch (e) {
			hasUploadError = true;
			toast.error(formatUploadError(e) || TOAST_MESSAGES.UPLOAD_ERROR_RETRY);
		} finally {
			if (!hasUploadError) {
				isUploading = false;
			}
		}
	}

	/**
	 * 从 Uppy 队列移除失败文件，仅用已成功文件拉取 `getBatchMedia` 并继续 `completePublish`
	 */
	async function removeFailedAndProceed(): Promise<void> {
		const uploader = mediaUploader;
		if (!uploader || !hasUploadError || !currentBatchId) return;
		const failed = uploader.uppy.getFiles().filter((f) => f.error);
		for (const f of failed) {
			uploader.uppy.removeFile(f.id);
		}
		hasUploadError = false;
		isUploading = false;
		const batchId = currentBatchId;
		try {
			// 仅含已成功上传的条目；可能为空数组
			const mediaAssets = await uploader.getBatchMedia(batchId);
			await options.completePublish(mediaAssets, batchId);
		} catch (e) {
			toast.error(formatUploadError(e) || TOAST_MESSAGES.UPLOAD_ERROR_RETRY);
		}
	}

	/** 用户取消上传：中止 Uppy、清除错误态并提示 */
	function cancelUpload(): void {
		uploadCancelled = true;
		mediaUploader?.cancelAll();
		hasUploadError = false;
		isUploading = false;
		toast.info(TOAST_MESSAGES.UPLOAD_CANCELLED);
	}

	return {
		init,
		destroy,
		submit,
		retry,
		removeFailedAndProceed,
		cancelUpload,
		/** 是否处于上传流程中（含等待重试的挂起态） */
		get isUploading() {
			return isUploading;
		},
		/** 已完成文件数、总文件数及可选整体进度百分比 */
		get uploadProgress() {
			return uploadProgress;
		},
		/** 是否存在待重试或待删除的失败上传 */
		get hasUploadError() {
			return hasUploadError;
		}
	};
}

/** `createReleaseUploadController` 的返回类型 */
export type ReleaseUploadController = ReturnType<typeof createReleaseUploadController>;
