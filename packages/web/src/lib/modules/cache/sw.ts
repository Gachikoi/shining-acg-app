/**
 * 为 URL 附加 cache-category 查询参数，使 Service Worker 能识别并分类缓存。
 *
 * 自动检测 URL 中是否已有查询参数，选择正确的分隔符（`&` 或 `?`），
 * 避免生成双 `?` 导致参数被吞入前一个 value 的问题。
 *
 * @param url - 原始资源 URL（undefined / 空字符串时返回空字符串）
 * @param category - 缓存桶名称（如 'feed-general'）
 * @returns 附加了 cache-category 参数的 URL
 */
export const resolveCacheUrl = (url: string | undefined, category: string): string => {
	if (!url) return '';
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}cache-category=${category}`;
};
