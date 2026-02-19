import type { V1Media as Media } from '$lib/api/types.gen';

/** 媒体资源基础 URL，与后端约定一致时可配置 */
const MEDIA_BASE: string = typeof window !== 'undefined' ? '' : '';

/**
 * 根据 Media 的 object_key 等生成可访问的展示 URL。
 * 若后端在别处返回 public_url，调用方可直接使用。
 */
export function getMediaDisplayUrl(media: Media | undefined): string {
	if (!media?.object_key) return '';
	// 若后端后续在 Media 或响应中提供 public_url，可在此优先使用
	if ('public_url' in media && typeof (media as { public_url?: string }).public_url === 'string') {
		return (media as { public_url: string }).public_url;
	}
	// 完整 URL（如 mock 或外链）直接返回
	const key = media.object_key;
	if (key.startsWith('http://') || key.startsWith('https://')) return key;
	const base = MEDIA_BASE;
	if (!base) return '';
	const path = key.startsWith('/') ? key.slice(1) : key;
	return `${base.replace(/\/$/, '')}/${path}`;
}
