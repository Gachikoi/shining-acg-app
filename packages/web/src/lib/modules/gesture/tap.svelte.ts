/**
 * @file 轻击手势 Svelte Action（Pointer Events）
 * @description
 * 检测一次轻击：按下 → 抬起，位移不超过阈值且耗时不超过上限。
 *
 * 核心特性：
 * - **阈值取消**：移动超过阈值立即失效，避免滑动误触
 * - **时长限制**：按下到抬起超过上限则不触发
 * - **竞技场集成**：触发前通过 arena.tryAcquire 仲裁，避免与 swipe/long-press 等冲突
 * - **不提前抢占**：仅在确认是 tap 时才竞争控制权，避免阻塞 swipe
 *
 * @example
 * ```svelte
 * <div
 *   use:tap={{
 *     excludeSelector: 'button, a, input',
 *     onTap: ({ clientX, clientY, target }) => {
 *       // 业务处理：打开预览 / 切换 UI 等
 *     }
 *   }}
 * />
 * ```
 */

import type { Action } from 'svelte/action';
import { release, tryAcquire } from './arena.svelte';
import type { TapOptions } from './types';
import { generateId } from './utils';

type Phase = 'idle' | 'tracking';

export const tap: Action<HTMLElement, TapOptions | undefined> = (node, initialOptions) => {
	const id = generateId('tap');
	const GESTURE_TYPE = 'tap';

	let opts: TapOptions = { ...initialOptions };

	const threshold = () => opts.threshold ?? 8;
	const maxDuration = () => opts.maxDuration ?? 350;

	let phase: Phase = 'idle';
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let startTime = 0;
	let startTarget: EventTarget | null = null;
	let moved = false;
	let pointerTarget: HTMLElement = node;

	function isExcluded(target: EventTarget | null): boolean {
		const selector = opts.excludeSelector;
		if (!selector) return false;
		const el = target as HTMLElement | null;
		return !!el?.closest?.(selector);
	}

	function reset() {
		phase = 'idle';
		pointerId = null;
		startX = 0;
		startY = 0;
		startTime = 0;
		startTarget = null;
		moved = false;
		pointerTarget = node;
	}

	function onPointerDown(e: PointerEvent) {
		if (opts.disabled?.()) return;
		// 仅跟踪主按键（mouse 左键）；touch/pen 一般为 0
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (pointerId !== null) return;
		if (isExcluded(e.target)) return;

		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		startTime = performance.now();
		startTarget = e.target;
		pointerTarget = (e.target as HTMLElement) ?? node;
		moved = false;
		phase = 'tracking';
	}

	function onPointerMove(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		if (phase !== 'tracking') return;

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (Math.hypot(dx, dy) > threshold()) {
			moved = true;
		}
	}

	function onPointerUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		if (phase !== 'tracking') {
			reset();
			return;
		}

		const duration = performance.now() - startTime;
		const target = startTarget ?? e.target ?? null;

		// 结束时若命中排除选择器，也不触发（覆盖“按下非排除→抬起排除”的边缘情况）
		if (!moved && duration <= maxDuration() && !isExcluded(target)) {
			const granted = tryAcquire({
				id,
				type: GESTURE_TYPE,
				node,
				axis: 'x',
				direction: 1,
				pointerTarget
			});

			if (granted) {
				try {
					opts.onTap?.({
						target,
						currentTarget: node,
						clientX: e.clientX,
						clientY: e.clientY,
						pointerType: e.pointerType
					});
				} finally {
					release(id);
				}
			}
		}

		reset();
	}

	function onPointerCancel(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		reset();
	}

	/**
	 * 指针捕获丢失：与 swipe/pull-refresh 相同的冒泡过滤规则
	 */
	function onLostPointerCapture(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		if (e.target !== node) return;
		reset();
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerCancel);
	node.addEventListener('lostpointercapture', onLostPointerCapture);

	return {
		update(newOptions: TapOptions | undefined) {
			opts = { ...newOptions };
		},
		destroy() {
			reset();
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerCancel);
			node.removeEventListener('lostpointercapture', onLostPointerCapture);
		}
	};
};
