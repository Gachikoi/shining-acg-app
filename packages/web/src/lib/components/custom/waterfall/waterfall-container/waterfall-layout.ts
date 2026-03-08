/**
 * @file 瀑布流布局引擎
 * @description
 * 纯函数模块，实现瀑布流（Masonry）卡片布局算法及首屏数据量估算。
 * 仅供 WaterfallContainer 组件及其宿主页面使用；
 * 响应式间距由调用方通过 breakpoint + remToPx（来自 $lib/modules/device）自行计算后传入。
 *
 * 核心算法：贪心最短列——每张新卡片放入当前高度最低的列，
 * 使各列高度尽可能均匀。
 */

// ─── 类型定义 ──────────────────────────────────────────────────────

/** 单张卡片在容器中的绝对定位信息 */
export interface CardPosition {
	/** 距容器顶部的距离（px） */
	top: number;
	/** 距容器左侧的距离（px） */
	left: number;
	/** 卡片宽度（px） */
	width: number;
	/** 卡片高度（含底部 gap，px） */
	height: number;
}

/** 布局基础参数（由容器宽度和配置计算得出） */
export interface LayoutBase {
	/** 列数 */
	columnCount: number;
	/** 单列卡片宽度（px） */
	cardWidth: number;
	/** 卡片间距（px） */
	gap: number;
}

/** 待布局的卡片信息 */
export interface LayoutItem {
	/** 卡片唯一标识 */
	id: string;
}

/** 增量布局计算的结果 */
export interface BatchLayoutResult {
	/** 本批次计算出的卡片位置数组 */
	positions: CardPosition[];
	/** 所有列中的最大高度（px） */
	maxHeight: number;
}

// ─── 核心函数 ──────────────────────────────────────────────────────

/**
 * 计算瀑布流布局的基础参数
 *
 * 根据容器宽度和最小卡片宽度，计算列数和实际卡片宽度。
 * 列数至少为 2，确保在任何容器宽度下都有瀑布流效果。
 *
 * @param containerWidth - 容器可用宽度（px）
 * @param minCardWidth - 最小卡片宽度（px）
 * @param gap - 卡片间距（px）
 * @returns 布局基础参数
 */
export function calculateLayoutBase(
	containerWidth: number,
	minCardWidth: number,
	gap: number
): LayoutBase {
	const columnCount = Math.max(2, Math.floor(containerWidth / minCardWidth));
	const cardWidth = (containerWidth - (columnCount - 1) * gap) / columnCount;
	return { columnCount, cardWidth, gap };
}

/**
 * 找到高度最低的列的索引（贪心选择）
 *
 * @param columnHeights - 各列当前高度数组
 * @returns 最短列的索引
 */
export function findMinColumnIndex(columnHeights: number[]): number {
	let minHeight = columnHeights[0];
	let minIndex = 0;
	for (let i = 1; i < columnHeights.length; i++) {
		if (columnHeights[i] < minHeight) {
			minHeight = columnHeights[i];
			minIndex = i;
		}
	}
	return minIndex;
}

/**
 * 批量计算卡片布局位置（支持增量计算）
 *
 * 遍历待布局的卡片列表，依次将每张卡片放入最短列。
 * 卡片高度优先使用 DOM 实测值（measuredHeights），
 * 未测量时降级为 cardWidth（1:1 正方形占位）。
 * 在 ResizeObserver 同步重算的架构下，占位值仅存在于同帧内、Paint 前即被修正。
 *
 * **注意：此函数会原地修改 columnHeights 数组。**
 *
 * @param items - 待布局的卡片列表
 * @param layout - 布局基础参数（列数、卡片宽度、间距）
 * @param columnHeights - 各列当前高度数组（会被修改）
 * @param measuredHeights - DOM 实测高度缓存（key = postId）
 * @returns 计算出的卡片位置和最大高度
 */
export function calculateBatchPositions(
	items: LayoutItem[],
	layout: LayoutBase,
	columnHeights: number[],
	measuredHeights: Map<string, number>
): BatchLayoutResult {
	const positions: CardPosition[] = [];
	let maxHeight = Math.max(...columnHeights, 0);

	for (const item of items) {
		const measuredHeight = measuredHeights.get(item.id);

		// 未测量时使用 cardWidth 作为占位高度（1:1 正方形）
		const cardContentHeight = measuredHeight ?? layout.cardWidth;
		// 卡片容器高度 = 内容高度 + 底部间距
		const cardHeight = cardContentHeight + layout.gap;

		const minIndex = findMinColumnIndex(columnHeights);
		const left = minIndex * (layout.cardWidth + layout.gap);
		const top = columnHeights[minIndex];

		positions.push({ top, left, width: layout.cardWidth, height: cardHeight });

		columnHeights[minIndex] = top + cardHeight;
		maxHeight = Math.max(maxHeight, columnHeights[minIndex]);
	}

	return { positions, maxHeight };
}
