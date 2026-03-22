/**
 * @file 拖拽重排 — Svelte Action（Pointer Events + GestureArena）
 * @description
 * 在**任意 HTMLElement** 上作为拖拽源（如手柄或**整条列表项**），将列表项从 `fromIndex` 重排到指针落点对应下标。
 * 使用横向 `tryAcquire` 与父级纵向 `scrollBoundary` 边界让渡策略配合；**触摸 / 笔**在 `pointerdown` 时即设
 * `touch-action: none`，进入 `dragging` 时再设 `user-select: none`，以减少 WebView / 移动端滚动抢手势。
 *
 * @remarks
 * - **阶段**：`idle` → `pending`（未超阈值）→ `dragging`（已 `tryAcquire` + `setPointerCapture`）。
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
import { release, tryAcquire } from '../core/arena.svelte';
import { generateId } from '../core/utils';
import { findListItemIndexUnderPoint } from './layout-measure';
import type { DragReorderOptions } from './types';

/** 识别器内部状态 */
type Phase = 'idle' | 'pending' | 'dragging';

const DEFAULT_ACTIVATION_PX = 8;

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

	function activationThreshold(): number {
		return opts.activationThreshold ?? DEFAULT_ACTIVATION_PX;
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

	function tryCreateDragPreview(e: PointerEvent): void {
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
			previewOffsetX = e.clientX - rect.left;
			previewOffsetY = e.clientY - rect.top;
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
			updatePreviewPosition(e.clientX, e.clientY);
			document.body.appendChild(clone);
		} catch {
			removeDragPreview();
		}
	}

	function teardownListeners(): void {
		node.removeEventListener('pointermove', onPointerMove);
		node.removeEventListener('pointerup', onPointerUp);
		node.removeEventListener('pointercancel', onPointerCancel);
		node.removeEventListener('lostpointercapture', onLostPointerCapture);
	}

	/** 未进入 `dragging` 时结束跟踪：移除监听并清除提前写入的 `touch-action` 等 */
	function resetPendingState(): void {
		clearDragStyles();
		teardownListeners();
		phase = 'idle';
		pointerId = null;
		hoverIndex = null;
		dragFromIndex = null;
	}

	/**
	 * @param success - `true` 时在 `from !== hover` 时调用 `onReorder`；`false` 为取消/丢失捕获
	 *
	 * @remarks
	 * `onReorder` 抛错时 `finally` 仍会 `release`、`removeDragPreview` 与 `clearDragStyles`；此时不会执行 `onDragEnd`（因异常已中断 try 块）。
	 */
	function endDrag(success: boolean): void {
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
	}

	function onPointerDown(e: PointerEvent): void {
		if (opts.disabled?.()) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (pointerId !== null) return;

		const targetEl = e.target as HTMLElement | null;
		const exclude = opts.excludePointerDownSelector;
		if (exclude && targetEl?.closest?.(exclude)) return;

		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		phase = 'pending';
		dragFromIndex = opts.fromIndex;
		hoverIndex = dragFromIndex;

		if (e.pointerType === 'touch' || e.pointerType === 'pen') {
			node.style.touchAction = 'none';
		}

		node.addEventListener('pointermove', onPointerMove);
		node.addEventListener('pointerup', onPointerUp);
		node.addEventListener('pointercancel', onPointerCancel);
		node.addEventListener('lostpointercapture', onLostPointerCapture);
	}

	function onPointerMove(e: PointerEvent): void {
		if (e.pointerId !== pointerId) return;

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (phase === 'pending') {
			if (Math.hypot(dx, dy) < activationThreshold()) return;

			const pointerTarget = (e.target as HTMLElement) ?? node;
			const granted = tryAcquire({
				id,
				type: GESTURE_TYPE,
				node: arenaElement(),
				axis: 'x',
				direction: dx >= 0 ? 1 : -1,
				pointerTarget
			});

			if (!granted) {
				resetPendingState();
				return;
			}

			acquired = true;
			phase = 'dragging';
			node.style.touchAction = 'none';
			node.style.userSelect = 'none';
			try {
				node.setPointerCapture(e.pointerId);
			} catch {
				// 部分环境可能抛错，仍继续拖拽跟踪
			}
			tryCreateDragPreview(e);
			try {
				opts.onDragStart?.();
			} catch {
				// ignore
			}
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

	node.addEventListener('pointerdown', onPointerDown);

	return {
		update(newOptions: DragReorderOptions) {
			opts = { ...newOptions };
		},
		destroy() {
			try {
				removeDragPreview();
				if (phase === 'dragging' && acquired) {
					release(id);
				}
			} finally {
				acquired = false;
				clearDragStyles();
				teardownListeners();
				node.removeEventListener('pointerdown', onPointerDown);
				phase = 'idle';
				pointerId = null;
				hoverIndex = null;
				dragFromIndex = null;
			}
		}
	};
};
