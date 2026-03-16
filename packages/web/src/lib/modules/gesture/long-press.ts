/**
 * @file 长按手势 Svelte Action
 * @description
 * 在元素上识别长按（按下超过阈值时间且位移小于阈值）。
 * 触发时占用全局手势锁，与同元素上的 swipe 互斥（先移动则 swipe 锁定，先到时间则 long-press 锁定）。
 *
 * @example
 * ```svelte
 * <div
 *   use:swipe={{ gestureType: GestureType.PREVIEW_SWIPE, ... }}
 *   use:tap={{ onTap: ... }}
 *   use:longPress={{ gestureType: GestureType.PREVIEW_LONG_PRESS, onPress, onPressUp }}
 * >
 * ```
 */

import type { Action } from 'svelte/action';
import { createGestureController, GestureType } from '$lib/modules/gesture';

export interface LongPressOptions {
	/** 使用的全局手势锁类型 */
	gestureType: GestureType;
	/** 长按判定时间（ms） */
	duration?: number;
	/** 视为“移动”的最小距离（px），超过则取消长按 */
	moveThreshold?: number;
	/** 不在此区域内的指针不参与 */
	excludeSelector?: string;
	/** 为 true 时仅 touch 触发长按，mouse 不触发 */
	touchOnly?: boolean;
	/** 长按触发时回调 */
	onPress?: (e: {
		x: number;
		y: number;
		clientX: number;
		clientY: number;
		target: EventTarget;
		currentTarget: HTMLElement;
	}) => void;
	/** 长按后松手回调 */
	onPressUp?: () => void;
}

const DEFAULT_DURATION = 550;
const DEFAULT_MOVE_THRESHOLD = 10;

export const longPress: Action<HTMLElement, LongPressOptions> = (node, options) => {
	if (!options?.gestureType) {
		return {
			update() {},
			destroy() {}
		};
	}
	let opts = { ...options };
	const getDuration = () => opts.duration ?? DEFAULT_DURATION;
	const getMoveThreshold = () => opts.moveThreshold ?? DEFAULT_MOVE_THRESHOLD;

	let pointerId: number | null = null;
	let startClientX = 0;
	let startClientY = 0;
	let longPressTriggered = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	const { canHandleGesture, lockGesture, unlockGesture } = createGestureController(
		opts.gestureType
	);

	function clearTimer() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function isExcluded(target: EventTarget | null): boolean {
		if (!opts.excludeSelector) return false;
		const el = target as HTMLElement;
		return !!el?.closest?.(opts.excludeSelector);
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.button !== 0 || pointerId !== null || isExcluded(e.target)) return;
		if (opts.touchOnly && e.pointerType !== 'touch') return;

		pointerId = e.pointerId;
		startClientX = e.clientX;
		startClientY = e.clientY;
		longPressTriggered = false;

		timer = setTimeout(() => {
			timer = null;
			if (!canHandleGesture()) return;
			const err = lockGesture();
			if (err) return;
			longPressTriggered = true;
			const rect = node.getBoundingClientRect();
			opts.onPress?.({
				x: startClientX - rect.left,
				y: startClientY - rect.top,
				clientX: startClientX,
				clientY: startClientY,
				target: e.target ?? node,
				currentTarget: node
			});
		}, getDuration());
	}

	function handlePointerMove(e: PointerEvent) {
		if (e.pointerId !== pointerId || longPressTriggered) return;
		const dx = e.clientX - startClientX;
		const dy = e.clientY - startClientY;
		if (dx * dx + dy * dy > getMoveThreshold() * getMoveThreshold()) {
			clearTimer();
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		clearTimer();
		if (longPressTriggered) {
			opts.onPressUp?.();
			unlockGesture();
		}
		pointerId = null;
		longPressTriggered = false;
	}

	function handlePointerCancel() {
		clearTimer();
		if (longPressTriggered) unlockGesture();
		pointerId = null;
		longPressTriggered = false;
	}

	node.addEventListener('pointerdown', handlePointerDown);
	node.addEventListener('pointermove', handlePointerMove);
	node.addEventListener('pointerup', handlePointerUp);
	node.addEventListener('pointercancel', handlePointerCancel);
	node.addEventListener('pointerleave', handlePointerUp);

	return {
		update(newOptions: LongPressOptions) {
			opts = { ...newOptions };
		},
		destroy() {
			clearTimer();
			if (longPressTriggered) unlockGesture();
			node.removeEventListener('pointerdown', handlePointerDown);
			node.removeEventListener('pointermove', handlePointerMove);
			node.removeEventListener('pointerup', handlePointerUp);
			node.removeEventListener('pointercancel', handlePointerCancel);
			node.removeEventListener('pointerleave', handlePointerUp);
		}
	};
};
