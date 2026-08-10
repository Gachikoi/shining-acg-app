/**
 * 发布页媒体适配层
 * 负责 File[] ↔ DraftMediaItem[] ↔ PrepareUploadParams 的转换
 */
import type { DraftMediaItem } from '$lib/stores/release';
import { buildPrepareUploadParams } from '$lib/modules/media-uploader';
import type { PrepareUploadParamAsset, PrepareUploadParams } from '$lib/modules/media-uploader';
import type { V1MediaScene } from '$lib/api/types.gen';

/**
 * PrepareUploadParams → DraftMediaItem[]
 * 从 File 提取 Blob+name，用于草稿持久化
 */
export function prepareParamsToDraftItems(params: PrepareUploadParams): DraftMediaItem[] {
	return params.map((asset): DraftMediaItem => {
		if (asset.kind === 'single') {
			return {
				kind: 'single',
				blob: asset.single.file,
				name: asset.single.file.name
			};
		}
		return {
			kind: 'live_photo',
			imageBlob: asset.livePhoto.image.file,
			videoBlob: asset.livePhoto.video.file,
			imageName: asset.livePhoto.image.file.name,
			videoName: asset.livePhoto.video.file.name
		};
	});
}

/**
 * DraftMediaItem[] → PrepareUploadParams
 * 重建 File 供 mediaUploader.upload 使用
 */
export function draftItemsToPrepareParams(
	items: DraftMediaItem[],
	scene: V1MediaScene
): PrepareUploadParams {
	return items.map((item): PrepareUploadParamAsset => {
		if (item.kind === 'single') {
			return {
				kind: 'single',
				scene,
				single: {
					file: new File([item.blob], item.name, { type: item.blob.type })
				}
			};
		}
		return {
			kind: 'live_photo',
			scene,
			livePhoto: {
				image: {
					file: new File([item.imageBlob], item.imageName, {
						type: item.imageBlob.type
					})
				},
				video: {
					file: new File([item.videoBlob], item.videoName, {
						type: item.videoBlob.type
					})
				}
			}
		};
	});
}

/**
 * File[] → DraftMediaItem[]
 * 复用 buildPrepareUploadParams 解析 Live Photo，再转为草稿格式
 */
export function filesToDraftItems(files: File[], scene: V1MediaScene): DraftMediaItem[] {
	const params = buildPrepareUploadParams({ scene, files });
	return prepareParamsToDraftItems(params);
}

/**
 * 获取预览用 Blob（single 用 blob，live_photo 用 imageBlob）
 */
export function getPreviewBlob(item: DraftMediaItem): Blob {
	return item.kind === 'single' ? item.blob : item.imageBlob;
}

/**
 * 比较 DraftMediaItem[] 是否相等（用于 dirty 检测）
 */
export function mediaItemsEqual(a: DraftMediaItem[], b: DraftMediaItem[]): boolean {
	const aList = a ?? [];
	const bList = b ?? [];
	if (aList.length !== bList.length) return false;
	return aList.every((item, i) => {
		const other = bList[i];
		if (item.kind !== other.kind) return false;
		if (item.kind === 'single' && other.kind === 'single') {
			return (
				item.blob.size === other.blob.size &&
				item.blob.type === other.blob.type &&
				item.name === other.name
			);
		}
		if (item.kind === 'live_photo' && other.kind === 'live_photo') {
			return (
				item.imageBlob.size === other.imageBlob.size &&
				item.imageBlob.type === other.imageBlob.type &&
				item.imageName === other.imageName &&
				item.videoBlob.size === other.videoBlob.size &&
				item.videoBlob.type === other.videoBlob.type &&
				item.videoName === other.videoName
			);
		}
		return false;
	});
}
