/**
 * 时间格式化（产品需求文档 3.1）
 *
 * - `formatTimeAccuracyFirst`：原则 B，准确性优先（私信、聊天记录等）
 * - `formatTimeAgo`：原则 A，即时性优先（帖子、评论、互动等）
 */

const WEEKDAY_NAMES = [
	'星期日',
	'星期一',
	'星期二',
	'星期三',
	'星期四',
	'星期五',
	'星期六'
] as const;

/**
 * 按「准确性优先」规则格式化时间
 * - 今天 → HH:mm
 * - 昨天 → 昨天 HH:mm
 * - 昨天以前，< 7 天 → 星期 X
 * - >= 7 天（本年）→ MM-DD
 * - 非本年 → YYYY-MM-DD
 */
export function formatTimeAccuracyFirst(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	const now = new Date();

	const pad = (n: number) => String(n).padStart(2, '0');
	const y = d.getFullYear();
	const m = d.getMonth();
	const day = d.getDate();
	const h = d.getHours();
	const min = d.getMinutes();

	const ny = now.getFullYear();
	const nm = now.getMonth();
	const nd = now.getDate();

	const todayStart = new Date(ny, nm, nd);
	const dateStart = new Date(y, m, day);
	const diffDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / (24 * 60 * 60 * 1000));

	if (diffDays === 0) {
		return `${pad(h)}:${pad(min)}`;
	}
	if (diffDays === 1) {
		return `昨天 ${pad(h)}:${pad(min)}`;
	}
	if (diffDays >= 2 && diffDays < 7) {
		return WEEKDAY_NAMES[d.getDay()];
	}
	if (y === ny) {
		return `${pad(m + 1)}-${pad(day)}`;
	}
	return `${y}-${pad(m + 1)}-${pad(day)}`;
}

// ---------------------------------------------------------------------------
// 即时性优先（产品需求文档 3.1 原则 A：帖子、评论、互动等）
// ---------------------------------------------------------------------------

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
