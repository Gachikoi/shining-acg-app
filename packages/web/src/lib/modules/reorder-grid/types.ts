/**
 * @file reorder-grid — 自研 wrap-grid 拖拽排序类型
 */

import type { Snippet } from 'svelte';

export type WrapGridLayoutSnapshot = {
	containerEl: HTMLElement;
	/**
	 * 与 `ResizeObserver` contentRect.width 一致，用于 `wrapGridColumnCount` / 槽位命中；
	 * 避免与 `getBoundingClientRect().width`（含边框/滚动条差异）混拼导致列数与指针预测不一致。
	 */
	contentWidthPx: number;
	cellW: number;
	cellH: number;
	gap: number;
	itemCount: number;
	hasFooter: boolean;
};

/** `createWrapGridDragSort` 返回值（显式声明以避免与 `ReturnType` 循环引用） */
export type WrapGridDragSort = {
	get phase(): 'idle' | 'dragging';
	get slotOrder(): number[];
	get activeSourceIndex(): number | null;
	/** 触摸排序延迟流程中已锁定「本格不吃纵向滚动」；null 表示未锁定 */
	get touchLockedSourceIndex(): number | null;
	/** 拖拽项左上角在容器内的 translate（px），与指针位置对齐，随 slotOrder 变化仍跟手 */
	get dragX(): number;
	get dragY(): number;
	cancelDrag: () => void;
	onItemPointerDown: (e: PointerEvent, sourceIndex: number, cellRoot?: Element) => void;
	onItemPointerMove: (e: PointerEvent) => void;
	onItemPointerUp: (e: PointerEvent) => void;
	onItemPointerCancel: (e: PointerEvent) => void;
	onLostPointerCapture: (e: PointerEvent) => void;
	bindCellListeners: (el: HTMLElement, sourceIndex: number) => () => void;
};

export type WrapGridDragSortFactoryOptions = {
	getItemCount: () => number;
	getLayout: () => WrapGridLayoutSnapshot | null;
	isDisabled: () => boolean;
	/** @default 450 — 常见长按排序默认值；0 表示无延迟 */
	delay?: number;
	/** 为 true 时 `delay` 仅作用于触摸/笔 */
	delayOnTouchOnly?: boolean;
	onReorder: (fromIndex: number, toIndex: number) => void;
	/** `onReorder` 抛错时调用；此情况下不会调用 `onDragEnd` */
	onReorderError?: (error: unknown) => void;
	onDragStart?: (fromIndex: number) => void;
	onDragEnd?: () => void;
};

export type ReorderGridProps<T> = {
	items: T[];
	/** 每项外层会追加 `absolute left-0 top-0` 与 measured 尺寸；可传 `size` 或 `h-24 w-24` 等 */
	itemCellClass?: string;
	footer?: Snippet;
	item: Snippet<[T, number]>;
	disabled?: boolean;
	delay?: number;
	delayOnTouchOnly?: boolean;
	onReorder: (fromIndex: number, toIndex: number) => void;
	onReorderError?: (error: unknown) => void;
	onDragStart?: (fromIndex: number) => void;
	onDragEnd?: () => void;
	class?: string;
	/** 传给容器根节点 */
	'aria-busy'?: boolean;
};
