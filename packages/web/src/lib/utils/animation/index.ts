/**
 * @file CSS transition 时长/缓动与「等待元素自身 transition 结束」工具（供 Feed 回弹等复用）
 */

/** 与 stack-item 中 `EASING` 一致 */
export const CSS_TRANSITION_EASING = 'cubic-bezier(0.45, 0, 0.55, 1)';

/** 与 stack-item 中 `DURATION` 一致（ms） */
export const CSS_TRANSITION_DURATION_MS = 300;

/**
 * 等待写在 `el` **自身**上的 CSS transition 全部结束（双 rAF 后 `getAnimations({ subtree: false })`）。
 *
 * @param el - 已写入 `transition` / `transform` 等的容器
 * @returns transition 结束或确认未产生过渡时 resolve
 */
export function waitForElementTransitions(el: HTMLElement): Promise<void> {
	return new Promise((resolve) => {
		const finish = () => {
			el.style.transition = 'none';
			resolve();
		};
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const anims = el.getAnimations({ subtree: false });
				if (anims.length === 0) {
					finish();
					return;
				}
				void Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {
					finish();
				});
			});
		});
	});
}
