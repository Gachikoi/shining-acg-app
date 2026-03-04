export function formatTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp * 1000;
	const hour = 60 * 60 * 1000;
	if (diff < hour) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
	if (diff < hour * 24) return `${Math.floor(diff / hour)} 小时前`;
	return new Date(timestamp * 1000).toLocaleDateString();
}

export function formatNumber(num: number): string {
	if (num >= 10000) {
		return (num / 10000).toFixed(1) + 'w';
	}
	if (num >= 1000) {
		return (num / 1000).toFixed(1) + 'k';
	}
	return num.toString();
}
