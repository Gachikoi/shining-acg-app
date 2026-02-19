export function isMobileUA(ua?: string): boolean {
	if (typeof navigator === 'undefined' && !ua) return false;
	const source = (ua ?? navigator.userAgent).toLowerCase();
	return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(source);
}
