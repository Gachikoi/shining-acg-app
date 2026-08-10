import type { V1PostContentUnit } from '$lib/api/types.gen';
import type { DraftMediaItem } from '$lib/stores/release';
import { getPreviewBlob } from '$lib/modules/release-media';
import {
	type CoverSource,
	DEFAULT_TEXT_COVER_STYLE_ID,
	type ExtractVideoFrameOptions,
	type RenderTextCoverOptions,
	type ResolveCoverBlobOptions,
	type TextCoverRenderer,
	type TextCoverStyleId
} from './types';
import { clamp, cleanText } from './utils';
import { getVideoBlob, isImageItem, isVideoItem } from './media-item-utils';
import {
	getTextCoverRenderer,
	isTextCoverStyleId,
	listTextCoverStyleIds,
	registerTextCoverRenderer
} from './text-cover-registry';
import { renderDefaultTextCover } from './text-cover-default';
import { extractVideoFrameBlob } from './video-frame';

export type {
	CoverSource,
	ExtractVideoFrameOptions,
	RenderTextCoverOptions,
	ResolveCoverBlobOptions,
	TextCoverRenderer,
	TextCoverStyleId
};
export { DEFAULT_TEXT_COVER_STYLE_ID };
export {
	extractVideoFrameBlob,
	getTextCoverRenderer,
	isTextCoverStyleId,
	listTextCoverStyleIds,
	registerTextCoverRenderer
};
export { isImageItem, isVideoItem } from './media-item-utils';

/** 骨架屏：浅灰，抽取中显示 */
export const PLACEHOLDER_VIDEO_LOADING =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect fill="#e5e5e5" width="96" height="96"/><text fill="#a3a3a3" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="12">加载中</text></svg>'
	);

/** 失败占位：深灰 +「视频」 */
export const PLACEHOLDER_VIDEO_FAILED =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect fill="#666" width="96" height="96"/><text fill="white" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14">视频</text></svg>'
	);

/** 获取用于缩略图显示的 Blob（图片直接返回，视频抽取首帧） */
export async function getPreviewBlobForDisplay(item: DraftMediaItem): Promise<Blob> {
	if (isImageItem(item)) {
		return getPreviewBlob(item);
	}
	if (isVideoItem(item)) {
		return extractVideoFrameBlob(getVideoBlob(item));
	}
	return getPreviewBlob(item);
}

export async function resolveCoverBlob(options: ResolveCoverBlobOptions): Promise<{
	blob: Blob;
	source: CoverSource;
}> {
	const items = options.mediaItems ?? [];
	if (items.length > 0) {
		// 策略优先级：用户当前选中项 > 同列表其他可用项 > 文本封面。
		const preferredIndex = clamp(options.selectedCoverIndex, 0, items.length - 1);
		const preferredItem = items[preferredIndex];
		if (isImageItem(preferredItem)) {
			return {
				blob: getPreviewBlob(preferredItem),
				source: 'selected-image'
			};
		}
		if (isVideoItem(preferredItem)) {
			const frameBlob = await extractVideoFrameBlob(getVideoBlob(preferredItem));
			return { blob: frameBlob, source: 'video-first-frame' };
		}

		const fallbackImage = items.find(isImageItem);
		if (fallbackImage) {
			return { blob: getPreviewBlob(fallbackImage), source: 'selected-image' };
		}
		const fallbackVideo = items.find(isVideoItem);
		if (fallbackVideo) {
			const frameBlob = await extractVideoFrameBlob(getVideoBlob(fallbackVideo));
			return { blob: frameBlob, source: 'video-first-frame' };
		}
	}

	// 未知样式 ID 回退 default，保证线上稳定。
	const styleId = isTextCoverStyleId(options.textCoverStyleId ?? '')
		? (options.textCoverStyleId as TextCoverStyleId)
		: DEFAULT_TEXT_COVER_STYLE_ID;
	const renderer =
		getTextCoverRenderer(styleId) ?? getTextCoverRenderer(DEFAULT_TEXT_COVER_STYLE_ID);
	if (!renderer) {
		throw new Error(`TextCoverRenderer "${DEFAULT_TEXT_COVER_STYLE_ID}" not registered`);
	}
	const textBlob = await renderer.render({
		title: options.title,
		bodyText: contentUnitsToPlainText(options.content ?? []),
		ratio: options.ratio
	});
	return { blob: textBlob, source: 'text-generated' };
}

function contentUnitsToPlainText(content: V1PostContentUnit[]): string {
	return cleanText(
		content
			.map((unit) => {
				if (unit.type === 'text') {
					return unit.content;
				}
				return `@${unit.name}`;
			})
			.join(' ')
	);
}

/**
 * 注册默认文字封面样式。
 * 模块加载时执行，供 resolveCoverBlob 使用；新增样式需在应用初始化时 register。
 */
registerTextCoverRenderer({
	id: DEFAULT_TEXT_COVER_STYLE_ID,
	render: renderDefaultTextCover
});
