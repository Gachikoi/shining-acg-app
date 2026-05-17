/**
 * @file wrap-grid — flex-wrap 等效网格的纯函数布局（固定 cell + gap）
 */

/** 与 flex-wrap 行为对齐的列数：至少 1 列 */
export function wrapGridColumnCount(
	containerWidthPx: number,
	cellWidthPx: number,
	gapPx: number
): number {
	if (containerWidthPx <= 0 || cellWidthPx <= 0) return 1;
	const step = cellWidthPx + gapPx;
	return Math.max(1, Math.floor((containerWidthPx + gapPx) / step));
}

export function wrapGridCellPosition(args: {
	index: number;
	columns: number;
	cellWidth: number;
	cellHeight: number;
	gap: number;
}): { x: number; y: number } {
	const { index, columns, cellWidth, cellHeight, gap } = args;
	const col = index % columns;
	const row = Math.floor(index / columns);
	return {
		x: col * (cellWidth + gap),
		y: row * (cellHeight + gap)
	};
}

export function wrapGridRowCount(slotCount: number, columns: number): number {
	if (slotCount <= 0 || columns <= 0) return 0;
	return Math.floor((slotCount + columns - 1) / columns);
}

export function wrapGridHeightPx(args: {
	rowCount: number;
	cellHeight: number;
	gap: number;
}): number {
	const { rowCount, cellHeight, gap } = args;
	if (rowCount <= 0) return 0;
	return rowCount * cellHeight + Math.max(0, rowCount - 1) * gap;
}

/**
 * 将容器内坐标映射到线性槽位（0..totalSlots-1）
 */
export function wrapGridSlotFromPoint(args: {
	dx: number;
	dy: number;
	columns: number;
	cellWidth: number;
	cellHeight: number;
	gap: number;
	totalSlots: number;
}): number {
	const { dx, dy, columns, cellWidth, cellHeight, gap, totalSlots } = args;
	if (totalSlots <= 0) return 0;
	const col = Math.floor(dx / (cellWidth + gap));
	const row = Math.floor(dy / (cellHeight + gap));
	const c = Math.max(0, Math.min(columns - 1, col));
	const r = Math.max(0, row);
	const slot = r * columns + c;
	return Math.max(0, Math.min(totalSlots - 1, slot));
}

/** 恒等排列 [0,1,...,n-1] */
export function identitySlotOrder(n: number): number[] {
	return Array.from({ length: n }, (_, i) => i);
}

/**
 * 将「源下标」`fromIndex` 在视觉序列中移动到 `targetSlot`（与 splice 插入下标语义一致）
 */
export function moveSlotOrder(
	slotOrder: number[],
	fromIndex: number,
	targetSlot: number
): number[] {
	const n = slotOrder.length;
	if (n === 0) return [];
	const cur = slotOrder.indexOf(fromIndex);
	if (cur < 0) return [...slotOrder];
	const t = Math.max(0, Math.min(n - 1, targetSlot));
	if (cur === t) return [...slotOrder];
	const next = slotOrder.slice();
	const [picked] = next.splice(cur, 1);
	next.splice(t, 0, picked!);
	return next;
}

/**
 * 从最终 `slotOrder` 取得 `reorderMedia(fromIndex, ·)` 的 `toIndex`
 */
export function toIndexForReorder(slotOrder: number[], fromIndex: number): number {
	return slotOrder.indexOf(fromIndex);
}

export function slotOrdersEqual(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}
