export function formatTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp * 1000;
	const hour = 60 * 60 * 1000;
	if (diff < hour) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
	if (diff < hour * 24) return `${Math.floor(diff / hour)} 小时前`;
	return new Date(timestamp * 1000).toLocaleDateString();
}
