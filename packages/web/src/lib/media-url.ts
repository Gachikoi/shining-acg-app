/**
 * 从 `V1MediaAsset` 解析浏览器可直接请求的展示地址（帖子封面、轮播图、视频封面、评论附图等）。
 *
 * **优先级**：`single`（或 Live Photo 下的 image/video）上的 `url` → `thumbnailUrl`（适合视频首帧）→ `objectKey` 拼 `MEDIA_BASE`。
 * **注意**：`MEDIA_BASE` 当前为空占位；若部署为 CDN/网关前缀，可在此统一拼接。`objectKey` 已为 `http(s)` 时原样返回。
 */
import type { V1MediaAsset as Media } from '$lib/api';

/** 对象存储或 CDN 根路径前缀；需与后端约定（SSR 时无 window，此处保持可配置） */
const MEDIA_BASE: string = typeof window !== 'undefined' ? '' : '';

/**
 * 返回用于 `<img src>` / `<video poster>` 等的展示 URL；无可用字段时返回空字符串。
 */
export function getMediaDisplayUrl(media: Media | undefined): string {
	if (!media) return '';

	// 统一取出实际文件资产：优先单文件，其次 Live Photo 的图片/视频
	const file = media.single ?? media.livePhoto?.image ?? media.livePhoto?.video ?? undefined;

	if (!file) return '';

	// 若后端直接返回了对外可访问 URL，则优先使用
	if (file.url && typeof file.url === 'string') {
		return file.url;
	}

	// 其次尝试缩略图 URL（例如视频首帧）
	if (file.thumbnailUrl && typeof file.thumbnailUrl === 'string') {
		return file.thumbnailUrl;
	}

	// 兼容旧逻辑：回退到 object_key
	const key = file.objectKey;
	if (!key) return '';
	if (key.startsWith('http://') || key.startsWith('https://')) return key;

	const base = MEDIA_BASE;
	if (!base) return '';
	const path = key.startsWith('/') ? key.slice(1) : key;
	return `${base.replace(/\/$/, '')}/${path}`;
}
