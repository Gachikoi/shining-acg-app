/**
 * @file 长按手势 Svelte Action（Pointer Events）
 * @description
 * 检测一次长按：按下并保持不动超过 delay 触发；移动超过阈值则取消。
 *
 * 核心特性：
 * - **计时触发**：delay 到点后触发 onPress
 * - **阈值取消**：移动超过阈值立即取消（避免与 swipe 冲突）
 * - **竞技场集成**：触发前通过 arena.tryAcquire 仲裁，避免与 swipe/tap 等冲突
 * - **原生菜单抑制**：长按追踪/触发期间阻止 contextmenu（移动端长按、桌面端右键）
 *
 * @example
 * ```svelte
 * <div
 *   use:longPress={{
 *     touchOnly: true,
 *     excludeSelector: 'button, a, input, .video-controls',
 *     onPress: ({ clientX, clientY }) => {
 *       // 业务处理：打开菜单/进入二倍速等
 *     },
 *     onPressUp: () => {
 *       // 松手恢复
 *     }
 *   }}
 * />
 * ```
 */

import type { Action } from 'svelte/action';
import { release, tryAcquire } from '../arena.svelte';
import type { LongPressOptions } from './types';
import { generateId } from '../utils';

type Phase = 'idle' | 'tracking' | 'pressed';

export const longPress: Action<HTMLElement, LongPressOptions | undefined> = (
	node,
	initialOptions
) => {
	const id = generateId('long-press');
	const GESTURE_TYPE = 'long-press';

	let opts: LongPressOptions = { ...initialOptions };

	const delay = () => opts.delay ?? 450;
	const threshold = () => opts.threshold ?? 10;
	const touchOnly = () => opts.touchOnly ?? false;

	let phase: Phase = 'idle';
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let startTarget: EventTarget | null = null;
	let pointerTarget: HTMLElement = node;
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let cancelled = false;

	function isExcluded(target: EventTarget | null): boolean {
		const selector = opts.excludeSelector;
		if (!selector) return false;
		const el = target as HTMLElement | null;
		return !!el?.closest?.(selector);
	}

	function clearTimer() {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function reset() {
		clearTimer();
		// 若处于 pressed，确保释放竞技场
		if (phase === 'pressed') {
			release(id);
		}
		phase = 'idle';
		pointerId = null;
		startX = 0;
		startY = 0;
		startTarget = null;
		pointerTarget = node;
		cancelled = false;
	}

	function firePress(clientX: number, clientY: number, pointerType: string) {
		if (phase !== 'tracking') return;
		if (cancelled) return;

		const granted = tryAcquire({
			id,
			type: GESTURE_TYPE,
			node,
			axis: 'x',
			direction: 1,
			pointerTarget
		});
		if (!granted) {
			cancelled = true;
			return;
		}

		phase = 'pressed';

		const rect = node.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;

		opts.onPress?.({
			target: startTarget,
			currentTarget: node,
			clientX,
			clientY,
			x,
			y,
			pointerType
		});
	}

	function onPointerDown(e: PointerEvent) {
		if (opts.disabled?.()) return;
		if (touchOnly() && e.pointerType !== 'touch') return;
		// 仅跟踪主按键（mouse 左键）；touch/pen 一般为 0
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (pointerId !== null) return;
		if (isExcluded(e.target)) return;

		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		startTarget = e.target;
		pointerTarget = (e.target as HTMLElement) ?? node;
		cancelled = false;
		phase = 'tracking';

		clearTimer();
		pressTimer = setTimeout(() => {
			pressTimer = null;
			if (pointerId === null) return;
			if (phase !== 'tracking') return;
			firePress(startX, startY, e.pointerType);
		}, delay());
	}

	function onPointerMove(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		if (phase !== 'tracking') return;

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (Math.hypot(dx, dy) > threshold()) {
			cancelled = true;
			clearTimer();
		}
	}

	function onPointerUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;

		// 若触发过 press，则松手回调
		if (phase === 'pressed') {
			try {
				opts.onPressUp?.();
			} finally {
				release(id);
			}
		}
		reset();
	}

	function onPointerCancel(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		reset();
	}

	function onLostPointerCapture(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		if (e.target !== node) return;
		reset();
	}

	/**
	 * 阻止浏览器原生 contextmenu（移动端长按/桌面端右键）
	 *
	 * 仅在本手势追踪/已触发期间阻止，避免影响正常右键菜单使用。
	 */
	function onContextMenu(e: Event) {
		if (phase === 'tracking' || phase === 'pressed') {
			e.preventDefault();
		}
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerCancel);
	node.addEventListener('lostpointercapture', onLostPointerCapture);
	node.addEventListener('contextmenu', onContextMenu);

	return {
		update(newOptions: LongPressOptions | undefined) {
			opts = { ...newOptions };
		},
		destroy() {
			reset();
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerCancel);
			node.removeEventListener('lostpointercapture', onLostPointerCapture);
			node.removeEventListener('contextmenu', onContextMenu);
		}
	};
};
