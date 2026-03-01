import type { V1MediaAsset as Media } from '$lib/api';

/** 媒体资源基础 URL，与后端约定一致时可配置 */
const MEDIA_BASE: string = typeof window !== 'undefined' ? '' : '';

/**
 * 根据媒体资产信息生成可访问的展示 URL。
 * 优先使用后端直接返回的 url/thumbnail_url，其次回退到 object_key + MEDIA_BASE。
 */
export function getMediaDisplayUrl(media: Media | undefined): string {
	if (!media) return '';

	// 统一取出实际文件资产：优先单文件，其次 Live Photo 的图片/视频
	const file = media.single ?? media.live_photo?.image ?? media.live_photo?.video ?? undefined;

	if (!file) return '';

	// 若后端直接返回了对外可访问 URL，则优先使用
	if (file.url && typeof file.url === 'string') {
		return file.url;
	}

	// 其次尝试缩略图 URL（例如视频首帧）
	if (file.thumbnail_url && typeof file.thumbnail_url === 'string') {
		return file.thumbnail_url;
	}

	// 兼容旧逻辑：回退到 object_key
	const key = file.object_key;
	if (!key) return '';
	if (key.startsWith('http://') || key.startsWith('https://')) return key;

	const base = MEDIA_BASE;
	if (!base) return '';
	const path = key.startsWith('/') ? key.slice(1) : key;
	return `${base.replace(/\/$/, '')}/${path}`;
}
