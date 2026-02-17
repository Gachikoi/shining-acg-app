/**
 * 即时性优先时间显示（用于帖子、评论、互动）
 * 规则：< 1 分钟 刚刚；1-59 分钟 xx 分钟前；1-23 小时 xx 小时前；
 * 1-6 天 x 天前；>= 7 天本年 MM-DD；非本年 YYYY-MM-DD
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
