/**
 * @module fly-to-rect
 *
 * **职责**：创建一个临时的 fixed `<img>`，并用 **Web Animations API** 将其从 `fromRect` 飞到 `toRect`。
 * 动画过程只使用 `transform/opacity`（起点定位仅设置一次 `left/top/width/height`），避免布局抖动。
 */
export type FlyToRectOptions = {
	srcUrl: string;
	fromRect: DOMRect;
	toRect: DOMRect;
	durationMs?: number;
	easing?: string;
	opacityTo?: number;
	zIndex?: number;
};

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return true;
	return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export function animateFlyToRect(options: FlyToRectOptions): Promise<void> {
	if (typeof document === 'undefined') return Promise.resolve();
	if (prefersReducedMotion()) return Promise.resolve();

	const {
		srcUrl,
		fromRect,
		toRect,
		durationMs = 520,
		easing = 'cubic-bezier(0.22, 0.61, 0.36, 1)',
		opacityTo = 1,
		zIndex = 9999
	} = options;

	if (fromRect.width < 2 || fromRect.height < 2) return Promise.resolve();
	if (toRect.width < 2 || toRect.height < 2) return Promise.resolve();

	const dx = toRect.left - fromRect.left;
	const dy = toRect.top - fromRect.top;
	const sx = toRect.width / fromRect.width;
	const sy = toRect.height / fromRect.height;

	return new Promise((resolve) => {
		const img = document.createElement('img');
		img.src = srcUrl;
		img.decoding = 'async';
		img.style.position = 'fixed';
		img.style.left = `${fromRect.left}px`;
		img.style.top = `${fromRect.top}px`;
		img.style.width = `${fromRect.width}px`;
		img.style.height = `${fromRect.height}px`;
		img.style.objectFit = 'contain';
		img.style.zIndex = `${zIndex}`;
		img.style.pointerEvents = 'none';
		img.style.transformOrigin = 'top left';
		img.style.willChange = 'transform, opacity';
		img.style.opacity = '1';

		document.body.appendChild(img);

		const cleanup = () => {
			img.remove();
			resolve();
		};

		try {
			const anim = img.animate(
				[
					{ transform: 'translate3d(0px, 0px, 0px) scale(1, 1)', opacity: 1 },
					{
						transform: `translate3d(${dx}px, ${dy}px, 0px) scale(${sx}, ${sy})`,
						opacity: opacityTo
					}
				],
				{
					duration: durationMs,
					easing,
					fill: 'forwards'
				}
			);
			anim.addEventListener('finish', cleanup, { once: true });
			anim.addEventListener('cancel', cleanup, { once: true });
			setTimeout(cleanup, durationMs + 120);
		} catch {
			cleanup();
		}
	});
}
