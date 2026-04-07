/**
 * @file wrap-grid-drag-sort — reorder-grid 模块：flex-wrap 网格上的指针拖拽排序（中间层 slotOrder，提交 from/to）
 */
import type { WrapGridDragSort, WrapGridDragSortFactoryOptions } from './types';
import {
	identitySlotOrder,
	moveSlotOrder,
	slotOrdersEqual,
	toIndexForReorder,
	wrapGridCellPosition,
	wrapGridColumnCount,
	wrapGridSlotFromPoint
} from './wrap-grid';

/**
 * 延迟计时期间：仅鼠标用小幅移动取消等待（便于点选而不误入拖拽）。
 * 触摸/笔不取消 —— 持稳过程中的指尖微抖常超过数 px，会先于排序掐掉延迟，
 * 与 `longPress`（默认 10px）叠加时表现为「长按震动/半透明但拖不动」。
 */
const MOVE_CANCEL_DELAY_MOUSE_PX = 8;
/** 鼠标等无延迟时，超过该位移才开始拖拽，避免点按误进拖拽 */
const DRAG_ACTIVATE_PX = 5;
/** 触摸按住超过该时间后再锁 `touch-none`，避免手指刚按下想立刻滑动页面时被卡死 */
const TOUCH_SORT_LOCK_MS = 80;

export type { WrapGridDragSort } from './types';

export function createWrapGridDragSort(options: WrapGridDragSortFactoryOptions): WrapGridDragSort {
	let slotOrder = $state<number[]>([]);
	let phase = $state<'idle' | 'dragging'>('idle');
	let activeSourceIndex = $state<number | null>(null);
	/** 拖拽项在容器坐标系下的绝对位置（跟手，不随 slot 基底跳动） */
	let dragX = $state(0);
	let dragY = $state(0);
	/** 按下点相对被拖格左上角的偏移（容器坐标） */
	let grabOffsetX = 0;
	let grabOffsetY = 0;

	let delayTimer: ReturnType<typeof setTimeout> | null = null;
	let pointerDown = false;
	/** `performance.now()`，用于触摸 delay 阶段在时间超过 {@link TOUCH_SORT_LOCK_MS} 后 `preventDefault` 打断页面滚动 */
	let pointerDownAt = 0;
	let startClientX = 0;
	let startClientY = 0;
	/** 最近指针位置（进入拖拽时用其算抓取偏移，避免长按时指尖相对按下点漂移） */
	let lastClientX = 0;
	let lastClientY = 0;
	let pendingSourceIndex = 0;
	let captureEl: Element | null = null;
	let lastPointerId = 0;
	/** 触摸+排序延迟：按住超过 {@link TOUCH_SORT_LOCK_MS} 后锁定本格，避免长按后下滑被当成页面滚动 */
	let touchLockedSourceIndex = $state<number | null>(null);
	let touchLockTimer: ReturnType<typeof setTimeout> | null = null;
	/** 拖拽阶段在 window capture 上跟踪指针，避免触摸下 capture 丢失后收不到元素上事件 */
	let windowDragListenersBound = false;
	/** pointerdown 后、尚未进入 dragging 前，在 window 上接收 move/up（触摸下子节点/滚动常吃掉单元格上的事件） */
	let windowPendingListenersBound = false;

	const sortApiRef: { current: WrapGridDragSort | null } = { current: null };

	function clearDelayTimer(): void {
		if (delayTimer != null) {
			clearTimeout(delayTimer);
			delayTimer = null;
		}
	}

	function clearTouchSortLock(): void {
		touchLockedSourceIndex = null;
		if (touchLockTimer != null) {
			clearTimeout(touchLockTimer);
			touchLockTimer = null;
		}
	}

	function tryReleasePointerCapture(pointerId: number): void {
		if (!(captureEl instanceof HTMLElement)) return;
		try {
			captureEl.releasePointerCapture(pointerId);
		} catch {
			/* noop */
		}
	}

	/**
	 * 统一回到 idle：解绑 window 监听、定时器、触摸锁；可选释放指针捕获；
	 * `notifyDragEnd` 为 true 时仅当**此前**处于 dragging 才调用 `onDragEnd`。
	 */
	function resetToIdle(resetOpts: { pointerIdForRelease?: number; notifyDragEnd: boolean }): void {
		const wasDragging = phase === 'dragging';
		clearTouchSortLock();
		unbindWindowPendingListeners();
		unbindWindowDragListeners();
		clearDelayTimer();
		pointerDown = false;

		const pid = resetOpts.pointerIdForRelease ?? (wasDragging ? lastPointerId : undefined);
		if (pid !== undefined) {
			tryReleasePointerCapture(pid);
		}

		captureEl = null;

		if (resetOpts.notifyDragEnd && wasDragging) {
			options.onDragEnd?.();
		}

		phase = 'idle';
		activeSourceIndex = null;
		dragX = 0;
		dragY = 0;
		slotOrder = identitySlotOrder(options.getItemCount());
	}

	function unbindWindowDragListeners(): void {
		if (!windowDragListenersBound) return;
		windowDragListenersBound = false;
		window.removeEventListener('pointermove', onWindowPointerMove, true);
		window.removeEventListener('touchmove', onWindowDragTouchMove, true);
		window.removeEventListener('pointerup', onWindowPointerUp, true);
		window.removeEventListener('pointercancel', onWindowPointerCancel, true);
	}

	function unbindWindowPendingListeners(): void {
		if (!windowPendingListenersBound) return;
		windowPendingListenersBound = false;
		window.removeEventListener('pointermove', onWindowPendingPointerMove, true);
		window.removeEventListener('touchmove', onWindowPendingTouchMove, true);
		window.removeEventListener('pointerup', onWindowPendingPointerUp, true);
		window.removeEventListener('pointercancel', onWindowPendingPointerCancel, true);
	}

	function bindWindowPendingListeners(): void {
		if (windowPendingListenersBound) return;
		windowPendingListenersBound = true;
		window.addEventListener('pointermove', onWindowPendingPointerMove, {
			capture: true,
			passive: false
		});
		window.addEventListener('touchmove', onWindowPendingTouchMove, {
			capture: true,
			passive: false
		});
		window.addEventListener('pointerup', onWindowPendingPointerUp, { capture: true });
		window.addEventListener('pointercancel', onWindowPendingPointerCancel, { capture: true });
	}

	/** WebKit 上文档滚动常走 `touchmove`；与 {@link onItemPointerMove} 中逻辑对齐 */
	function onWindowPendingTouchMove(e: TouchEvent): void {
		if (phase === 'dragging' || !pointerDown || delayTimer == null) return;
		if (
			touchLockedSourceIndex !== null ||
			(typeof performance !== 'undefined' &&
				performance.now() - pointerDownAt >= TOUCH_SORT_LOCK_MS)
		) {
			if (e.cancelable) e.preventDefault();
		}
	}

	function onWindowPendingPointerMove(e: PointerEvent): void {
		if (e.pointerId !== lastPointerId || phase === 'dragging' || !pointerDown) return;
		sortApiRef.current?.onItemPointerMove(e);
	}

	function onWindowPendingPointerUp(e: PointerEvent): void {
		if (e.pointerId !== lastPointerId) return;
		if (!pointerDown && phase !== 'dragging') return;
		sortApiRef.current?.onItemPointerUp(e);
	}

	function onWindowPendingPointerCancel(e: PointerEvent): void {
		if (e.pointerId !== lastPointerId) return;
		sortApiRef.current?.onItemPointerCancel(e);
	}

	function bindWindowDragListeners(): void {
		if (windowDragListenersBound) return;
		windowDragListenersBound = true;
		window.addEventListener('pointermove', onWindowPointerMove, { capture: true, passive: false });
		window.addEventListener('touchmove', onWindowDragTouchMove, { capture: true, passive: false });
		window.addEventListener('pointerup', onWindowPointerUp, { capture: true });
		window.addEventListener('pointercancel', onWindowPointerCancel, { capture: true });
	}

	function onWindowDragTouchMove(e: TouchEvent): void {
		if (phase !== 'dragging') return;
		if (e.cancelable) e.preventDefault();
	}

	function syncDragPositionFromClient(clientX: number, clientY: number): void {
		const layout = options.getLayout();
		if (layout == null || phase !== 'dragging') return;
		const rect = layout.containerEl.getBoundingClientRect();
		dragX = clientX - rect.left - grabOffsetX;
		dragY = clientY - rect.top - grabOffsetY;
	}

	function onWindowPointerMove(e: PointerEvent): void {
		if (e.pointerId !== lastPointerId || phase !== 'dragging') return;
		syncDragPositionFromClient(e.clientX, e.clientY);
		updateHoverOrder(e.clientX, e.clientY);
		if (e.cancelable) e.preventDefault();
	}

	function onWindowPointerUp(e: PointerEvent): void {
		if (e.pointerId !== lastPointerId || phase !== 'dragging') return;
		pointerDown = false;
		clearDelayTimer();
		finishDrag();
	}

	function onWindowPointerCancel(e: PointerEvent): void {
		if (e.pointerId !== lastPointerId) return;
		resetToIdle({ pointerIdForRelease: e.pointerId, notifyDragEnd: true });
	}

	function cancelDrag(): void {
		resetToIdle({ notifyDragEnd: true });
	}

	function effectiveDelayMs(pointerType: string): number {
		const isTouchLike = pointerType === 'touch' || pointerType === 'pen';
		if (options.delayOnTouchOnly && !isTouchLike) return 0;
		return options.delay ?? 450;
	}

	function beginDrag(): boolean {
		if (phase === 'dragging') return true;
		clearTouchSortLock();
		unbindWindowPendingListeners();
		clearDelayTimer();
		if (options.isDisabled()) return false;
		const n = options.getItemCount();
		if (n <= 1) return false;
		if (pendingSourceIndex < 0 || pendingSourceIndex >= n) return false;

		const layout = options.getLayout();
		if (layout == null) return false;
		const { containerEl, cellW, cellH, gap, contentWidthPx } = layout;
		const rect = containerEl.getBoundingClientRect();
		const cols = wrapGridColumnCount(contentWidthPx, cellW, gap);
		const pos = wrapGridCellPosition({
			index: pendingSourceIndex,
			columns: cols,
			cellWidth: cellW,
			cellHeight: cellH,
			gap
		});
		grabOffsetX = lastClientX - rect.left - pos.x;
		grabOffsetY = lastClientY - rect.top - pos.y;

		phase = 'dragging';
		activeSourceIndex = pendingSourceIndex;
		dragX = lastClientX - rect.left - grabOffsetX;
		dragY = lastClientY - rect.top - grabOffsetY;
		slotOrder = identitySlotOrder(n);
		options.onDragStart?.(pendingSourceIndex);

		if (captureEl instanceof HTMLElement) {
			try {
				captureEl.setPointerCapture(lastPointerId);
			} catch {
				/* noop */
			}
		}
		bindWindowDragListeners();
		return true;
	}

	function onReorderCommitted(fromIndex: number, toIndex: number): void {
		if (fromIndex === toIndex) {
			options.onDragEnd?.();
			return;
		}
		try {
			options.onReorder(fromIndex, toIndex);
			options.onDragEnd?.();
		} catch (error) {
			console.error('wrapGridDragSort onReorder failed:', error);
			options.onReorderError?.(error);
		}
	}

	function finishDrag(): void {
		unbindWindowDragListeners();
		if (phase !== 'dragging' || activeSourceIndex == null) {
			return;
		}
		if (captureEl instanceof HTMLElement) {
			try {
				captureEl.releasePointerCapture(lastPointerId);
			} catch {
				/* noop */
			}
		}
		const fromIndex = activeSourceIndex;
		const base = identitySlotOrder(options.getItemCount());
		if (slotOrdersEqual(slotOrder, base)) {
			options.onDragEnd?.();
		} else {
			const toIndex = toIndexForReorder(slotOrder, fromIndex);
			onReorderCommitted(fromIndex, toIndex);
		}
		phase = 'idle';
		activeSourceIndex = null;
		dragX = 0;
		dragY = 0;
		slotOrder = identitySlotOrder(options.getItemCount());
		captureEl = null;
	}

	function updateHoverOrder(clientX: number, clientY: number): void {
		const layout = options.getLayout();
		if (layout == null || phase !== 'dragging' || activeSourceIndex == null) return;
		const { containerEl, cellW, cellH, gap, contentWidthPx, itemCount, hasFooter } = layout;
		const rect = containerEl.getBoundingClientRect();
		const dx = clientX - rect.left;
		const dy = clientY - rect.top;
		const cols = wrapGridColumnCount(contentWidthPx, cellW, gap);
		const mediaSlots = itemCount;
		const targetSlot = wrapGridSlotFromPoint({
			dx,
			dy,
			columns: cols,
			cellWidth: cellW,
			cellHeight: cellH,
			gap,
			totalSlots: mediaSlots + (hasFooter ? 1 : 0)
		});
		const insertSlot = Math.min(targetSlot, mediaSlots - 1);
		slotOrder = moveSlotOrder(slotOrder, activeSourceIndex, insertSlot);
	}

	$effect(() => {
		const n = options.getItemCount();
		if (options.isDisabled() && (phase === 'dragging' || touchLockedSourceIndex !== null)) {
			cancelDrag();
		}
		if (phase === 'dragging') {
			if (n !== slotOrder.length) {
				cancelDrag();
			}
			return;
		}
		if (n !== slotOrder.length) {
			slotOrder = identitySlotOrder(n);
		}
	});

	if (typeof document !== 'undefined') {
		$effect(() => {
			const onVisibility = (): void => {
				if (document.visibilityState === 'hidden' && phase === 'dragging') {
					cancelDrag();
				}
			};
			document.addEventListener('visibilitychange', onVisibility);
			return () => document.removeEventListener('visibilitychange', onVisibility);
		});
	}

	const sortApi = {
		get phase() {
			return phase;
		},
		get slotOrder() {
			return slotOrder;
		},
		get activeSourceIndex() {
			return activeSourceIndex;
		},
		get touchLockedSourceIndex() {
			return touchLockedSourceIndex;
		},
		get dragX() {
			return dragX;
		},
		get dragY() {
			return dragY;
		},
		cancelDrag,
		onItemPointerDown(e: PointerEvent, sourceIndex: number, cellRoot?: Element): void {
			if (options.isDisabled()) return;
			if (phase === 'dragging') return;
			const n = options.getItemCount();
			if (n <= 1) return;

			pointerDown = true;
			pointerDownAt = typeof performance !== 'undefined' ? performance.now() : 0;
			startClientX = lastClientX = e.clientX;
			startClientY = lastClientY = e.clientY;
			pendingSourceIndex = sourceIndex;
			captureEl = (cellRoot ?? e.currentTarget) as Element;
			lastPointerId = e.pointerId;

			const delayMs = effectiveDelayMs(e.pointerType);
			clearTouchSortLock();
			unbindWindowPendingListeners();
			clearDelayTimer();
			bindWindowPendingListeners();
			const isTouchLike = e.pointerType === 'touch' || e.pointerType === 'pen';
			if (delayMs > 0 && isTouchLike) {
				const idx = sourceIndex;
				touchLockTimer = setTimeout(() => {
					touchLockTimer = null;
					if (pointerDown && pendingSourceIndex === idx) {
						touchLockedSourceIndex = idx;
					}
				}, TOUCH_SORT_LOCK_MS);
				delayTimer = setTimeout(() => {
					if (!pointerDown) return;
					void beginDrag();
				}, delayMs);
			} else if (delayMs > 0) {
				delayTimer = setTimeout(() => {
					if (!pointerDown) return;
					void beginDrag();
				}, delayMs);
			}
		},
		onItemPointerMove(e: PointerEvent): void {
			if (!pointerDown || options.isDisabled()) return;
			lastClientX = e.clientX;
			lastClientY = e.clientY;
			if (phase === 'dragging') {
				return;
			}

			const isTouchLike = e.pointerType === 'touch' || e.pointerType === 'pen';
			/**
			 * 仅靠 `touch-action` 无法中断已判给文档滚动的手势；在「延迟排序」后半段对 move 默认行为兜底禁止，
			 * 否则长按后再滑仍会滚外层 `overflow-y-auto`（尤其是 iOS / Chrome 触摸）。
			 */
			if (
				isTouchLike &&
				delayTimer != null &&
				(touchLockedSourceIndex !== null ||
					(typeof performance !== 'undefined' &&
						performance.now() - pointerDownAt >= TOUCH_SORT_LOCK_MS))
			) {
				if (e.cancelable) e.preventDefault();
			}

			const movedCancel = isTouchLike
				? false
				: Math.abs(e.clientX - startClientX) > MOVE_CANCEL_DELAY_MOUSE_PX ||
					Math.abs(e.clientY - startClientY) > MOVE_CANCEL_DELAY_MOUSE_PX;
			const movedActivate =
				Math.abs(e.clientX - startClientX) > DRAG_ACTIVATE_PX ||
				Math.abs(e.clientY - startClientY) > DRAG_ACTIVATE_PX;

			if (delayTimer != null && movedCancel) {
				clearDelayTimer();
				clearTouchSortLock();
				unbindWindowPendingListeners();
				pointerDown = false;
				captureEl = null;
				return;
			}
			if (delayTimer == null && movedActivate) {
				const started = beginDrag();
				if (started) {
					syncDragPositionFromClient(e.clientX, e.clientY);
					updateHoverOrder(e.clientX, e.clientY);
					if (e.cancelable) e.preventDefault();
				}
			}
		},
		onItemPointerUp(e: PointerEvent): void {
			if (e.pointerId !== lastPointerId) return;
			clearTouchSortLock();
			unbindWindowPendingListeners();
			pointerDown = false;
			clearDelayTimer();
			if (phase === 'dragging') {
				finishDrag();
			}
			captureEl = null;
		},
		onItemPointerCancel(e: PointerEvent): void {
			if (e.pointerId !== lastPointerId) return;
			resetToIdle({ pointerIdForRelease: e.pointerId, notifyDragEnd: true });
		},
		onLostPointerCapture(e: PointerEvent): void {
			if (e.pointerId !== lastPointerId) return;
			if (phase === 'dragging' && windowDragListenersBound) {
				return;
			}
			if (phase === 'dragging') {
				cancelDrag();
			}
		},
		bindCellListeners(el: HTMLElement, sourceIndex: number): () => void {
			const cap: AddEventListenerOptions = { capture: true, passive: false };
			const bub: AddEventListenerOptions = { passive: false };
			const down = (ev: Event) => sortApi.onItemPointerDown(ev as PointerEvent, sourceIndex, el);
			const move = (ev: Event) => sortApi.onItemPointerMove(ev as PointerEvent);
			const up = (ev: Event) => sortApi.onItemPointerUp(ev as PointerEvent);
			const cancel = (ev: Event) => sortApi.onItemPointerCancel(ev as PointerEvent);
			const lost = (ev: Event) => sortApi.onLostPointerCapture(ev as PointerEvent);
			el.addEventListener('pointerdown', down, cap);
			el.addEventListener('pointermove', move, bub);
			el.addEventListener('pointerup', up, bub);
			el.addEventListener('pointercancel', cancel, bub);
			el.addEventListener('lostpointercapture', lost);
			return () => {
				el.removeEventListener('pointerdown', down, cap);
				el.removeEventListener('pointermove', move, bub);
				el.removeEventListener('pointerup', up, bub);
				el.removeEventListener('pointercancel', cancel, bub);
				el.removeEventListener('lostpointercapture', lost);
			};
		}
	};

	sortApiRef.current = sortApi;
	return sortApi as WrapGridDragSort;
}
