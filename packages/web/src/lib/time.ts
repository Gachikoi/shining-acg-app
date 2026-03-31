/**
 * 社区场景相对时间文案（帖子、评论、互动列表等）
 *
 * **输入**：`formatTimeAgo` 接受秒级时间戳、`Date` 可解析的 ISO 字符串、或毫秒级时间戳字符串（数值串且 >1e12 时会按毫秒换算为秒）。非法或空值返回 `''`。
 *
 * **输出规则**：<1 分钟 →「刚刚」；<1 小时 →「N 分钟前」；<24 小时 →「N 小时前」；<7 天 →「N 天前」；
 * 满 7 天及以上：同年显示 `MM-DD`，跨年显示 `YYYY-MM-DD`。
 */
export function formatTimeAgo(timestamp: string | number | undefined): string {
	if (timestamp === undefined || timestamp === null) return '';
	let ts: number;
	if (typeof timestamp === 'number') {
		ts = timestamp;
	} else if (timestamp.includes('T') || timestamp.includes('-')) {
		ts = Math.floor(new Date(timestamp).getTime() / 1000);
	} else {
		ts = parseInt(timestamp, 10);
		// API 类型为毫秒级时间戳字符串；纯数字且足够大时按毫秒处理
		if (ts > 1e12) ts = Math.floor(ts / 1000);
	}
	if (Number.isNaN(ts)) return '';
	const now = Math.floor(Date.now() / 1000);
	const diff = now - ts;
	const date = new Date(ts * 1000);
	const nowDate = new Date();

	if (diff < 60) return '刚刚';
	if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
	if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} 天前`;
	if (date.getFullYear() === nowDate.getFullYear()) {
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${m}-${d}`;
	}
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}
