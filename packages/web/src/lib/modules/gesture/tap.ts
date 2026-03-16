/**
 * @file 轻击手势 Svelte Action
 * @description
 * 在元素上识别轻击（短时间、小位移的按下-抬起）。
 * 触发时占用手势锁：先 lock，再调用 onTap，再 unlock，与同元素上的 swipe/long-press 互斥。
 *
 * @example
 * ```svelte
 * <div
 *   use:swipe={{ gestureType: GestureType.PREVIEW_SWIPE, onSwipeMove, onSwipeEnd, onSwipeCancel }}
 *   use:tap={{ gestureType: GestureType.TAP, onTap: (d) => handleContentTap(d.target) }}
 *   use:longPress={{ gestureType: GestureType.PREVIEW_LONG_PRESS, onPress, onPressUp }}
 * >
 * ```
 */

import type { Action } from 'svelte/action';
import { createGestureController, GestureType } from '$lib/modules/gesture';

export interface TapOptions {
	/** 从按下到松手小于此时间（ms）视为 tap */
	tapTimeframe?: number;
	/** 位移超过此值（px）不视为 tap */
	moveThreshold?: number;
	/** 不在此区域内的指针不参与（如 '.video-controls'） */
	excludeSelector?: string;
	/**
	 * 使用的全局手势锁类型，与同元素上的 swipe/long-press 互斥时需与同一上下文一致
	 * @default GestureType.TAP
	 */
	gestureType?: GestureType;
	/** 轻击回调；若无法占锁（已被其他手势锁定）则不会调用 */
	onTap?: (detail: { target: EventTarget; clientX: number; clientY: number }) => void;
}

const DEFAULT_TAP_TIMEFRAME = 250;
const DEFAULT_MOVE_THRESHOLD = 10;

export const tap: Action<HTMLElement, TapOptions> = (node, options = {}) => {
	let opts = { ...options };
	const getTapTimeframe = () => opts.tapTimeframe ?? DEFAULT_TAP_TIMEFRAME;
	const getMoveThreshold = () => opts.moveThreshold ?? DEFAULT_MOVE_THRESHOLD;
	const getGestureType = () => opts.gestureType ?? GestureType.TAP;
	const { lockGesture, unlockGesture } = createGestureController(getGestureType());

	let pointerId: number | null = null;
	let startClientX = 0;
	let startClientY = 0;
	let startTime = 0;
	let totalMoveSq = 0;

	function isExcluded(target: EventTarget | null): boolean {
		if (!opts.excludeSelector) return false;
		const el = target as HTMLElement;
		return !!el?.closest?.(opts.excludeSelector);
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.button !== 0 || pointerId !== null || isExcluded(e.target)) return;
		pointerId = e.pointerId;
		startClientX = e.clientX;
		startClientY = e.clientY;
		startTime = Date.now();
		totalMoveSq = 0;
	}

	function handlePointerMove(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		const dx = e.clientX - startClientX;
		const dy = e.clientY - startClientY;
		totalMoveSq = dx * dx + dy * dy;
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		const dt = Date.now() - startTime;
		const threshold = getMoveThreshold();
		const isTap = dt < getTapTimeframe() && totalMoveSq < threshold * threshold && opts.onTap;
		if (isTap) {
			const err = lockGesture();
			if (!err) {
				try {
					opts.onTap?.({
						target: e.target ?? node,
						clientX: startClientX,
						clientY: startClientY
					});
				} finally {
					unlockGesture();
				}
			}
		}
		pointerId = null;
	}

	node.addEventListener('pointerdown', handlePointerDown);
	node.addEventListener('pointermove', handlePointerMove);
	node.addEventListener('pointerup', handlePointerUp);
	function handlePointerCancel() {
		pointerId = null;
	}

	node.addEventListener('pointercancel', handlePointerCancel);
	node.addEventListener('pointerleave', handlePointerUp);

	return {
		update(newOptions: TapOptions) {
			opts = { ...newOptions };
		},
		destroy() {
			node.removeEventListener('pointerdown', handlePointerDown);
			node.removeEventListener('pointermove', handlePointerMove);
			node.removeEventListener('pointerup', handlePointerUp);
			node.removeEventListener('pointercancel', handlePointerCancel);
			node.removeEventListener('pointerleave', handlePointerUp);
		}
	};
};
