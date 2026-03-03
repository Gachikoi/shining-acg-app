/**
 * 时间格式化工具
 * 产品需求文档 3.1 - 准确性优先规则
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
