/**
 * 将 canvas 导出为 Blob。
 * quality 仅对 image/jpeg 和 image/webp 生效，PNG 为无损格式会忽略 quality。
 */
export function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
	quality: number
): Promise<Blob> {
	return new Promise<Blob>((resolve, reject) => {
		const onBlob = (blob: Blob | null) => {
			if (!blob) {
				reject(new Error('Failed to export canvas blob'));
				return;
			}
			resolve(blob);
		};
		if (mimeType === 'image/png') {
			canvas.toBlob(onBlob, mimeType);
		} else {
			canvas.toBlob(onBlob, mimeType, quality);
		}
	});
}

export function cleanText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
