/**
 * @file reorder-grid — transform + slotOrder 自研网格拖拽重排
 */

export { default as ReorderGrid } from './reorder-grid.svelte';
export { createWrapGridDragSort } from './wrap-grid-drag-sort.svelte';
export type {
	ReorderGridProps,
	WrapGridDragSort,
	WrapGridDragSortFactoryOptions,
	WrapGridLayoutSnapshot
} from './types';
export {
	wrapGridCellPosition,
	wrapGridColumnCount,
	wrapGridHeightPx,
	wrapGridRowCount,
	wrapGridSlotFromPoint,
	identitySlotOrder,
	moveSlotOrder,
	toIndexForReorder,
	slotOrdersEqual
} from './wrap-grid';
