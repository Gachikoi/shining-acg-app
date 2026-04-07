/**
 * @file 虚拟滚动范围计算（纯函数；不依赖 UI 框架）
 *
 * 提供两种独立算法：
 * - `calculatePositionedVisibleRange`：基于预计算 `ItemPosition[]`，精确，支持任意高度，瀑布流专用
 * - `calculateGridVisibleRange`：基于等高假设，O(1) 算法，支持 1~N 列 grid，线性列表专用
 */

// ─── 共用类型 ─────────────────────────────────────────────────────

/** 元素的纵向位置信息（用于 `calculatePositionedVisibleRange`） */
export interface ItemPosition {
	/** 元素顶部距容器顶部的距离（px） */
	top: number;
	/** 元素高度（px） */
	height: number;
}

/** 可见范围（闭区间 [start, end]） */
export interface VisibleRange {
	start: number;
	end: number;
}

// ─── calculatePositionedVisibleRange ─────────────────────────────

/**
 * 基于预计算坐标数组的虚拟滚动参数。
 * 适用于绝对定位布局（瀑布流），每个元素 top/height 已由布局引擎精确计算。
 */
export interface PositionedVirtualScrollParams {
	/** 每个元素的精确位置信息 */
	items: ItemPosition[];
	scrollTop: number;
	viewportHeight: number;
	/**
	 * 视口外缓冲区大小（px）。
	 * 滚动方向前后各预渲染 bufferPx，防止快速滚动时出现空白。
	 * @default 1600
	 */
	bufferPx?: number;
	/**
	 * 启用二分查找的元素数量阈值。
	 * 超过此值时使用 O(log n) 二分，否则 O(n) 线性扫描。
	 * @default 100
	 */
	binarySearchThreshold?: number;
}

/**
 * 虚拟列表配置（供瀑布流等组件作为 `virtualScrollRange` 默认值）
 */
export interface VirtualScrollRangeConfig {
	/** 视口外缓冲区大小（px），默认 1600 */
	bufferPx: number;
	/** 启用二分查找的元素数量阈值，默认 100 */
	binarySearchThreshold: number;
}

/** 与 `calculatePositionedVisibleRange` 内部默认一致；供瀑布流等作为 `virtualScrollRange` 默认值 */
export const DEFAULT_VIRTUAL_SCROLL_RANGE: VirtualScrollRangeConfig = {
	bufferPx: 1600,
	binarySearchThreshold: 100
};

/**
 * 基于预计算坐标数组计算虚拟滚动可见元素范围。
 *
 * 适用场景：绝对定位布局，元素高度不一且已由布局引擎精确计算（如瀑布流）。
 * 元素数量超过 `binarySearchThreshold` 时自动切换为 O(log n) 二分查找。
 *
 * @param params - 虚拟滚动计算参数
 * @returns 可见范围（闭区间 [start, end]）
 */
export function calculatePositionedVisibleRange(
	params: PositionedVirtualScrollParams
): VisibleRange {
	const { items, scrollTop, viewportHeight, bufferPx = 1600, binarySearchThreshold = 100 } = params;

	if (items.length === 0) return { start: 0, end: 0 };

	const startBuffer = Math.max(0, scrollTop - bufferPx);
	const endBuffer = scrollTop + viewportHeight + bufferPx;

	if (items.length > binarySearchThreshold) {
		const start = binarySearchRangeStart(items, startBuffer);
		const end = binarySearchRangeEnd(items, endBuffer);
		return { start, end: Math.max(start, end) };
	}

	let start = -1;
	let end = 0;

	for (let i = 0; i < items.length; i++) {
		const pos = items[i];
		if (pos.top > endBuffer) break;

		if (pos.top + pos.height >= startBuffer) {
			if (start === -1) start = i;
			end = i;
		}
	}

	if (start === -1) start = 0;
	return { start, end };
}

function binarySearchRangeStart(items: ItemPosition[], target: number): number {
	let left = 0;
	let right = items.length - 1;
	let result = items.length;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		if (items[mid].top + items[mid].height >= target) {
			result = mid;
			right = mid - 1;
		} else {
			left = mid + 1;
		}
	}

	return result;
}

function binarySearchRangeEnd(items: ItemPosition[], target: number): number {
	let left = 0;
	let right = items.length - 1;
	let result = 0;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		if (items[mid].top <= target) {
			result = mid;
			left = mid + 1;
		} else {
			right = mid - 1;
		}
	}

	return result;
}

// ─── calculateGridVisibleRange ────────────────────────────────────

/**
 * 等高 grid 虚拟滚动参数。
 * 所有元素高度相同，支持 1~N 列布局。
 */
export interface GridVirtualScrollParams {
	/** 数据总条数 */
	count: number;
	/**
	 * 每个元素的高度（px）。
	 * 多列时指"行高"——同一行中所有列高度相同。
	 */
	itemHeight: number;
	/**
	 * 列数。
	 * 1（默认）= 线性列表；2+ = 多列 grid，每行渲染 `columnCount` 个元素。
	 * @default 1
	 */
	columnCount?: number;
	scrollTop: number;
	viewportHeight: number;
	/**
	 * 视口外缓冲区大小（px）。
	 * @default 800
	 */
	bufferPx?: number;
}

/**
 * 基于等高假设计算虚拟滚动可见元素范围（O(1)）。
 *
 * 适用场景：所有元素等高的线性列表（用户行、通知行）或等高多列 grid（2列卡片网格）。
 * 不需要维护 `ItemPosition[]` 位置数组，直接由行号推算 item 索引。
 *
 * 算法：
 * ```
 * rowCount = ceil(count / columnCount)
 * startRow = max(0, floor((scrollTop - bufferPx) / itemHeight))
 * endRow   = min(rowCount−1, ceil((scrollTop + viewportHeight + bufferPx) / itemHeight) − 1)
 * start    = startRow × columnCount
 * end      = min(count−1, (endRow+1) × columnCount − 1)
 * ```
 *
 * @param params - 等高 grid 虚拟滚动参数
 * @returns 可见范围（闭区间 [start, end]）
 */
export function calculateGridVisibleRange(params: GridVirtualScrollParams): VisibleRange {
	const { count, itemHeight, columnCount = 1, scrollTop, viewportHeight, bufferPx = 800 } = params;
	// console.log('calculateGridVisibleRange', scrollTop, itemHeight);
	if (count === 0 || itemHeight <= 0) return { start: 0, end: 0 };

	const rowCount = Math.ceil(count / columnCount);
	const startRow = Math.max(0, Math.floor((scrollTop - bufferPx) / itemHeight));
	const endRow = Math.min(
		rowCount - 1,
		Math.ceil((scrollTop + viewportHeight + bufferPx) / itemHeight) - 1
	);

	const start = startRow * columnCount;
	const end = Math.min(count - 1, (endRow + 1) * columnCount - 1);

	return { start, end };
}
