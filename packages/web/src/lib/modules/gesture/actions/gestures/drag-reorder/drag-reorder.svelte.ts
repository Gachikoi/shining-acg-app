/**
 * @file 拖拽重排 — Svelte Action（Pointer Events + GestureArena）
 * @deprecated 发布页等媒体网格已改用 `$lib/modules/sortable-list`（SortableJS）。本 Action 保留至全仓无引用后再移除。
 * @description
 * 在**任意 HTMLElement** 上作为拖拽源（如手柄或**整条列表项**），将列表项从 `fromIndex` 重排到指针落点对应下标。
 * 使用横向 `tryAcquire` 与父级纵向 `scrollBoundary` 边界让渡策略配合；**触摸 / 笔**在 `pointerdown` 时即设
 * `touch-action: none`，进入 `dragging` 时再设 `user-select: none`，以减少 WebView / 移动端滚动抢手势。
 *
 * @remarks
 * - **阶段**：`idle` → `pending`（长按计时）→ `dragging`（`tryAcquire` 后建预览并 `onDragStart`）。**鼠标**立即 `setPointerCapture`；**触摸/笔不捕获**（立即捕获易触发 `lostpointercapture`），跟手依赖 `window` 捕获阶段监听。
 * - **移动端**：`window` 上 `pointermove`/`up`/`cancel` 使用 `passive: false`，触摸/笔在 `pending`/`dragging` 的 `pointermove` 上 `preventDefault` 以减轻滚动抢走指针；`pending`/`dragging` 期间拦截 `contextmenu`；触摸/笔在 `pointerdown` 时设 `touch-action: none` 与 `-webkit-touch-callout: none`（不在 `pointerdown` 上 `preventDefault`，以免部分环境/DevTools 触摸指示异常）。
 * - **失败**：`tryAcquire` 被拒绝时立即 teardown，不持有竞技场。
 * - **取消**：`pointercancel` / `lostpointercapture` 下不调用 `onReorder`，并 `release`。
 * - **起点下标**：`pointerdown` 时快照 `opts.fromIndex`，`endDrag` 使用该快照而非实时 `opts.fromIndex`，避免 `update()` 中途改写下标。
 * - **跟手虚影**：可选 `dragPreview: { mode: 'clone-list-item', ... }`；`endDrag`/`destroy` 的 `finally` 中必定 `remove` 克隆节点。
 * - **轻触**：可选 `onPendingPointerUp`；仅在正常 `pointerup` 且未进入 `dragging` 时触发（与 `pointercancel` 路径区分）。
 *
 * @example
 * ```svelte
 * <div bind:this={listEl} class="flex flex-wrap gap-2">
 *   {#each items as _, i (i)}
 *     <div data-sortable-item>
 *       <button
 *         type="button"
 *         aria-label="排序"
 *         use:dragReorder={{
 *           getItemElements: () =>
 *             Array.from(listEl.querySelectorAll<HTMLElement>('[data-sortable-item]')),
 *           getArenaNode: () => listEl.closest('[data-body-scroll]'),
 *           fromIndex: i,
 *           onReorder: (from, to) => reorderArray(from, to),
 *           disabled: () => isUploading,
 *           dragPreview: { mode: 'clone-list-item', className: 'shadow-lg' }
 *         }}
 *       >
 *         ⋮
 *       </button>
 *     </div>
 *   {/each}
 * </div>
 * ```
 */

import type { Action } from 'svelte/action';
import { release, tryAcquire } from '../../../core/arena.svelte';
import { generateId } from '../../../core/utils';
import { findListItemIndexUnderPoint } from './layout-measure';
import type { DragReorderOptions } from './types';

/** 识别器内部状态 */
type Phase = 'idle' | 'pending' | 'dragging';

const DEFAULT_LONG_PRESS_MS = 450;

const DEFAULT_LONG_PRESS_MOVE_CANCEL_PX = 10;

const DEFAULT_PREVIEW_OPACITY = 0.88;

const DEFAULT_PREVIEW_Z_INDEX = 60;

function stripElementIds(root: HTMLElement): void {
	root.removeAttribute('id');
	for (const el of root.querySelectorAll<HTMLElement>('*')) {
		el.removeAttribute('id');
	}
}

/** 与 `GestureArena` 约定的手势类型标识，用于互斥与动画打断策略 */
const GESTURE_TYPE = 'drag-reorder';

/**
 * `window` 上捕获阶段监听；`passive: false` 以便触摸/笔在 `pointermove` 上 `preventDefault`，
 * 避免浏览器把同一指针用于滚动并触发 `pointercancel`（默认 passive 时无法阻止）。
 */
const WINDOW_POINTER_OPTS: AddEventListenerOptions = { capture: true, passive: false };

/** `contextmenu` 捕获阶段 + 非 passive：子节点（如 `img`）长按弹出菜单时也能拦截 */
const NODE_CONTEXTMENU_OPTS: AddEventListenerOptions = { capture: true, passive: false };

/**
 * 列表拖拽重排：绑定在拖拽手柄（或整条可拖项）上
 *
 * @param node - 接收 `pointerdown` 的拖拽源元素（可为整条列表项根节点；子控件用 `excludePointerDownSelector` 排除）
 * @param initialOptions - 见 {@link DragReorderOptions}
 */
export const dragReorder: Action<HTMLElement, DragReorderOptions> = (node, initialOptions) => {
	const id = generateId('drag-reorder');
	let opts: DragReorderOptions = { ...initialOptions };

	let phase: Phase = 'idle';
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	/** 指针按下时冻结的 `fromIndex`，避免拖拽过程中 `update()` 改写 `opts.fromIndex` 导致 `onReorder` 起点错乱 */
	let dragFromIndex: number | null = null;
	let hoverIndex: number | null = null;
	let acquired = false;
	let previewEl: HTMLElement | null = null;
	let previewOffsetX = 0;
	let previewOffsetY = 0;
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	/** 等待长按期间位移超阈值后为 `true`，定时器回调不得再进入 dragging */
	let longPressCancelled = false;
	/** `pointerdown` 时的 target，供 `tryAcquire.pointerTarget`（与 `long-press` 一致） */
	let pendingPointerTarget: HTMLElement = node;
	let lastClientX = 0;
	let lastClientY = 0;
	/** 本次序列的 `pointerType`；触摸/笔上 `setPointerCapture` 常被系统立即撤销并触发 `lostpointercapture`，故仅鼠标捕获 */
	let activePointerType = '';

	function longPressDurationMs(): number {
		return opts.longPressDurationMs ?? DEFAULT_LONG_PRESS_MS;
	}

	function longPressMoveCancelPx(): number {
		return opts.longPressMoveCancelPx ?? DEFAULT_LONG_PRESS_MOVE_CANCEL_PX;
	}

	function clearPressTimer(): void {
		if (pressTimer !== null) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	/** 供 `tryAcquire.node` 使用，影响 scrollBoundary 边界让渡判定 */
	function arenaElement(): HTMLElement {
		const fromGetter = opts.getArenaNode?.() ?? null;
		if (fromGetter) return fromGetter;
		if (opts.listRoot) return opts.listRoot;
		return document.body;
	}

	function clearDragStyles(): void {
		node.style.removeProperty('touch-action');
		node.style.removeProperty('user-select');
		node.style.removeProperty('-webkit-touch-callout');
	}

	function removeDragPreview(): void {
		if (previewEl) {
			previewEl.style.removeProperty('will-change');
			previewEl.remove();
			previewEl = null;
		}
	}

	function updatePreviewPosition(clientX: number, clientY: number): void {
		if (!previewEl) return;
		const x = Math.round(clientX - previewOffsetX);
		const y = Math.round(clientY - previewOffsetY);
		previewEl.style.transform = `translate3d(${x}px,${y}px,0)`;
	}

	function tryCreateDragPreview(clientX: number, clientY: number): void {
		const cfg = opts.dragPreview;
		if (!cfg || cfg.mode !== 'clone-list-item') return;
		const from = dragFromIndex;
		if (from == null) return;
		let items: HTMLElement[];
		try {
			items = opts.getItemElements();
		} catch {
			return;
		}
		const source = items[from];
		if (!source) return;
		try {
			const clone = source.cloneNode(true) as HTMLElement;
			stripElementIds(clone);
			clone.setAttribute('aria-hidden', 'true');
			const rect = source.getBoundingClientRect();
			previewOffsetX = clientX - rect.left;
			previewOffsetY = clientY - rect.top;
			const w = Math.round(rect.width);
			const h = Math.round(rect.height);
			clone.style.position = 'fixed';
			clone.style.left = '0';
			clone.style.top = '0';
			clone.style.width = `${w}px`;
			clone.style.height = `${h}px`;
			clone.style.boxSizing = 'border-box';
			clone.style.pointerEvents = 'none';
			clone.style.margin = '0';
			clone.style.opacity = String(cfg.opacity ?? DEFAULT_PREVIEW_OPACITY);
			clone.style.zIndex = String(cfg.zIndex ?? DEFAULT_PREVIEW_Z_INDEX);
			clone.style.willChange = 'transform';
			for (const token of (cfg.className ?? '').trim().split(/\s+/).filter(Boolean)) {
				clone.classList.add(token);
			}
			// 先挂到 previewEl，再挂 DOM：`appendChild` 之后若抛错，`removeDragPreview` 仍能移除；且 `updatePreviewPosition` 依赖 previewEl
			previewEl = clone;
			updatePreviewPosition(clientX, clientY);
			document.body.appendChild(clone);
		} catch {
			removeDragPreview();
		}
	}

	function teardownListeners(): void {
		window.removeEventListener('pointermove', onPointerMove, WINDOW_POINTER_OPTS);
		window.removeEventListener('pointerup', onPointerUp, WINDOW_POINTER_OPTS);
		window.removeEventListener('pointercancel', onPointerCancel, WINDOW_POINTER_OPTS);
		node.removeEventListener('lostpointercapture', onLostPointerCapture);
	}

	function isTouchLikePointer(): boolean {
		return activePointerType === 'touch' || activePointerType === 'pen';
	}

	/** 未进入 `dragging` 时结束跟踪：移除监听并清除提前写入的 `touch-action` 等 */
	function resetPendingState(): void {
		clearPressTimer();
		longPressCancelled = false;
		clearDragStyles();
		teardownListeners();
		phase = 'idle';
		pointerId = null;
		hoverIndex = null;
		dragFromIndex = null;
		activePointerType = '';
	}

	/** 从 `pending` 切入 `dragging`：`tryAcquire`、捕获指针、预览与 `onDragStart` */
	function activateDragging(clientX: number, clientY: number): void {
		if (phase !== 'pending' || pointerId === null) return;

		clearPressTimer();

		const granted = tryAcquire({
			id,
			type: GESTURE_TYPE,
			node: arenaElement(),
			axis: 'x',
			direction: 1,
			pointerTarget: pendingPointerTarget,
			startX,
			startY
		});

		if (!granted) {
			resetPendingState();
			return;
		}

		acquired = true;
		phase = 'dragging';
		node.style.touchAction = 'none';
		node.style.userSelect = 'none';
		const pid = pointerId;
		// 触摸/笔：不 setPointerCapture，避免 WebKit/Chrome 很快 `lostpointercapture`/`pointercancel` 打断拖拽；跟手依赖 window 捕获监听
		if (activePointerType === 'mouse') {
			try {
				node.setPointerCapture(pid);
			} catch {
				// 部分环境可能抛错，仍继续拖拽跟踪
			}
		}
		tryCreateDragPreview(clientX, clientY);
		try {
			opts.onDragStart?.();
		} catch {
			// ignore
		}
	}

	/**
	 * @param success - `true` 时在 `from !== hover` 时调用 `onReorder`；`false` 为取消/丢失捕获
	 *
	 * @remarks
	 * `onReorder` 抛错时 `finally` 仍会 `release`、`removeDragPreview` 与 `clearDragStyles`；此时不会执行 `onDragEnd`（因异常已中断 try 块）。
	 */
	function endDrag(success: boolean): void {
		clearPressTimer();
		if (phase === 'dragging' && acquired) {
			const from = dragFromIndex ?? opts.fromIndex;
			const to = hoverIndex ?? from;
			try {
				if (success && from !== to) {
					opts.onReorder(from, to);
				}
				opts.onDragEnd?.();
			} finally {
				release(id);
				acquired = false;
				removeDragPreview();
				clearDragStyles();
			}
		}
		teardownListeners();
		phase = 'idle';
		pointerId = null;
		hoverIndex = null;
		dragFromIndex = null;
		activePointerType = '';
	}

	function onPointerDown(e: PointerEvent): void {
		if (opts.disabled?.()) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (pointerId !== null) return;

		const targetEl = e.target as HTMLElement | null;
		const exclude = opts.excludePointerDownSelector;
		if (exclude && targetEl?.closest?.(exclude)) return;

		pointerId = e.pointerId;
		activePointerType = e.pointerType;
		startX = e.clientX;
		startY = e.clientY;
		lastClientX = e.clientX;
		lastClientY = e.clientY;
		longPressCancelled = false;
		pendingPointerTarget = (e.target as HTMLElement) ?? node;
		phase = 'pending';
		dragFromIndex = opts.fromIndex;
		hoverIndex = dragFromIndex;

		if (e.pointerType === 'touch' || e.pointerType === 'pen') {
			node.style.touchAction = 'none';
			node.style.setProperty('-webkit-touch-callout', 'none');
		}

		clearPressTimer();
		pressTimer = setTimeout(() => {
			pressTimer = null;
			if (pointerId === null) return;
			if (phase !== 'pending') return;
			if (longPressCancelled) return;
			activateDragging(lastClientX, lastClientY);
		}, longPressDurationMs());

		window.addEventListener('pointermove', onPointerMove, WINDOW_POINTER_OPTS);
		window.addEventListener('pointerup', onPointerUp, WINDOW_POINTER_OPTS);
		window.addEventListener('pointercancel', onPointerCancel, WINDOW_POINTER_OPTS);
		node.addEventListener('lostpointercapture', onLostPointerCapture);
	}

	function onPointerMove(e: PointerEvent): void {
		if (e.pointerId !== pointerId) return;

		lastClientX = e.clientX;
		lastClientY = e.clientY;

		if (isTouchLikePointer() && (phase === 'pending' || phase === 'dragging')) {
			e.preventDefault();
		}

		if (phase === 'pending') {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			const dist = Math.hypot(dx, dy);
			const cancelPx = longPressMoveCancelPx();
			if (dist > cancelPx) {
				longPressCancelled = true;
				clearPressTimer();
			}
			return;
		}

		if (phase !== 'dragging') return;

		updatePreviewPosition(e.clientX, e.clientY);

		try {
			const items = opts.getItemElements();
			const idx = findListItemIndexUnderPoint(e.clientX, e.clientY, items);
			if (idx !== null) {
				hoverIndex = idx;
			}
		} catch {
			// 与 `tryCreateDragPreview` 一致：`getItemElements` 在 DOM 突变时可能抛错；本帧跳过落点更新，保留上次 hoverIndex，不中断拖拽
		}
	}

	function onPointerUp(e: PointerEvent): void {
		if (e.pointerId !== pointerId) return;
		const wasDragging = phase === 'dragging';
		try {
			node.releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		if (wasDragging) {
			endDrag(true);
		} else {
			try {
				opts.onPendingPointerUp?.(e);
			} finally {
				resetPendingState();
			}
		}
	}

	function onPointerCancel(e: PointerEvent): void {
		if (e.pointerId !== pointerId) return;
		try {
			node.releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		if (phase === 'dragging') {
			endDrag(false);
		} else {
			resetPendingState();
		}
	}

	function onLostPointerCapture(e: PointerEvent): void {
		if (e.pointerId !== pointerId) return;
		if (phase === 'dragging') {
			endDrag(false);
		} else {
			resetPendingState();
		}
	}

	/** 触摸长按会合成 `contextmenu`，浏览器常伴随 `pointercancel`；跟踪/拖拽期间必须拦截（与 `long-press` 一致） */
	function onContextMenuDuringTracking(e: Event): void {
		if (phase !== 'pending' && phase !== 'dragging') return;
		e.preventDefault();
	}

	node.addEventListener('contextmenu', onContextMenuDuringTracking, NODE_CONTEXTMENU_OPTS);
	node.addEventListener('pointerdown', onPointerDown);

	return {
		update(newOptions: DragReorderOptions) {
			opts = { ...newOptions };
		},
		destroy() {
			try {
				clearPressTimer();
				removeDragPreview();
				if (phase === 'dragging' && acquired) {
					release(id);
				}
			} finally {
				acquired = false;
				longPressCancelled = false;
				clearDragStyles();
				teardownListeners();
				node.removeEventListener('contextmenu', onContextMenuDuringTracking, NODE_CONTEXTMENU_OPTS);
				node.removeEventListener('pointerdown', onPointerDown);
				phase = 'idle';
				pointerId = null;
				hoverIndex = null;
				dragFromIndex = null;
				activePointerType = '';
			}
		}
	};
};
