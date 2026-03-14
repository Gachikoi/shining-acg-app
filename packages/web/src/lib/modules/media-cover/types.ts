import type { V1PostContentUnit } from '$lib/api/types.gen';
import type { CoverRatio, DraftMediaItem } from '$lib/stores/release';

export type CoverSource = 'selected-image' | 'video-first-frame' | 'text-generated';

/** 文字封面样式 ID，用于 registry 查找与草稿持久化。未知 ID 回退 default。 */
export type TextCoverStyleId = string;

/** 默认样式 ID，新增样式时需在 registry 中注册。 */
export const DEFAULT_TEXT_COVER_STYLE_ID: TextCoverStyleId = 'default';

/**
 * 文字封面渲染器接口。实现者负责将标题+正文按比例绘制到 canvas 并导出 Blob。
 */
export interface TextCoverRenderer {
	id: TextCoverStyleId;
	render(options: RenderTextCoverOptions): Promise<Blob>;
}

export interface ExtractVideoFrameOptions {
	timeSec?: number;
	fallbackTimeSec?: number;
	maxLongEdge?: number;
	/** 输出格式。quality 仅在 image/jpeg 或 image/webp 时生效，PNG 为无损格式会忽略 quality。 */
	mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
	/** 压缩质量 0–1，仅对 image/jpeg 和 image/webp 有效。 */
	quality?: number;
}

export interface RenderTextCoverOptions {
	title?: string;
	bodyText?: string;
	ratio: CoverRatio;
}

export interface ResolveCoverBlobOptions {
	mediaItems: DraftMediaItem[];
	selectedCoverIndex: number;
	ratio: CoverRatio;
	title?: string;
	content?: V1PostContentUnit[];
	/** 文字封面样式 ID，未传或非法时回退 default。 */
	textCoverStyleId?: TextCoverStyleId;
}

export const DEFAULT_LONG_EDGE = 1280;
export const DEFAULT_VIDEO_TIME_SEC = 0.1;
export const DEFAULT_VIDEO_FALLBACK_TIME_SEC = 0;
export const DEFAULT_TEXT_BG = '#0f172a';
export const DEFAULT_TEXT_FG = '#f8fafc';
export const DEFAULT_TEXT_SUB = '#cbd5e1';
