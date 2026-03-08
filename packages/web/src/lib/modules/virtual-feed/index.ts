/**
 * @file 虚拟滚动范围计算模块
 * @description
 * 纯函数模块，根据滚动位置和视口高度计算当前应渲染的元素范围。
 * 支持线性查找和二分查找两种策略，自动根据数据量选择最优算法。
 * 不依赖任何 UI 框架，可独立复用。
 */

import { calculateLayoutBase } from '$lib/components/custom/waterfall/waterfall-container/waterfall-layout';

// ─── 类型定义 ──────────────────────────────────────────────────────

/** 元素的纵向位置信息（用于虚拟滚动计算） */
export interface ItemPosition {
	/** 元素顶部距容器顶部的距离（px） */
	top: number;
	/** 元素高度（px） */
	height: number;
}

/** 可见范围（闭区间 [start, end]） */
export interface VisibleRange {
	/** 第一个可见元素的索引 */
	start: number;
	/** 最后一个可见元素的索引 */
	end: number;
}

/** 虚拟滚动计算参数 */
export interface VirtualScrollParams {
	/** 所有元素的位置信息数组 */
	items: ItemPosition[];
	/** 当前滚动位置（scrollTop，px） */
	scrollTop: number;
	/** 视口可见高度（px） */
	viewportHeight: number;
	/** 缓冲区大小倍数（扩大可见范围以减少快速滚动时的白屏） */
	bufferSize: number;
	/** 缓冲区基础高度（px） */
	bufferHeight: number;
	/** 使用二分查找的元素数量阈值 */
	binarySearchThreshold: number;
}

// ─── 核心函数 ──────────────────────────────────────────────────────

/**
 * 计算虚拟滚动的可见元素范围
 *
 * 根据当前滚动位置和视口高度，结合缓冲区配置，
 * 计算出应该渲染哪些元素。仅渲染可见范围内的元素可以显著
 * 减少 DOM 节点数量，提升大列表的渲染性能。
 *
 * 当元素数量超过 binarySearchThreshold 时自动切换到二分查找，
 * 将时间复杂度从 O(n) 降低到 O(log n)。
 *
 * @param params - 虚拟滚动计算参数
 * @returns 可见范围（闭区间）
 */
export function calculateVisibleRange(params: VirtualScrollParams): VisibleRange {
	const { items, scrollTop, viewportHeight, bufferSize, bufferHeight, binarySearchThreshold } =
		params;

	if (items.length === 0) return { start: 0, end: 0 };

	// 扩展可见区域：在视口上下各加一个缓冲带，减少快速滚动时的白屏
	const visibleBuffer = bufferSize * bufferHeight;
	const startBuffer = Math.max(0, scrollTop - visibleBuffer);
	const endBuffer = scrollTop + viewportHeight + visibleBuffer;

	if (items.length > binarySearchThreshold) {
		// 大数据量：使用二分查找 O(log n)
		const start = binarySearchRangeStart(items, startBuffer);
		const end = binarySearchRangeEnd(items, endBuffer);
		return { start, end: Math.max(start, end) };
	}

	// 小数据量：线性查找 O(n)
	let start = -1;
	let end = 0;

	for (let i = 0; i < items.length; i++) {
		const pos = items[i];
		// 优化：瀑布流中 top 大致递增，一旦超出缓冲区底部即可终止
		if (pos.top > endBuffer) break;

		if (pos.top + pos.height >= startBuffer) {
			if (start === -1) start = i;
			end = i;
		}
	}

	if (start === -1) start = 0;
	return { start, end };
}

// ─── 内部辅助函数 ──────────────────────────────────────────────────

/**
 * 二分查找可见范围的起始索引
 * 找到第一个「底边 >= target」的元素
 *
 * @param items - 按 top 大致递增排列的元素位置数组
 * @param target - 缓冲区上边界（px）
 * @returns 起始索引
 */
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

/**
 * 二分查找可见范围的结束索引
 * 找到最后一个「顶边 <= target」的元素
 *
 * @param items - 按 top 大致递增排列的元素位置数组
 * @param target - 缓冲区下边界（px）
 * @returns 结束索引
 */
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

// ─── 首屏数据量估算 ──────────────────────────────────────────────

/** estimateNeedNum 的参数 */
export interface EstimateNeedNumParams {
	/** 容器可用宽度（px） */
	containerWidth: number;
	/** 容器可用高度（px）——即滚动视口高度 */
	containerHeight: number;
	/** 最小卡片宽度（px）；默认 160，覆盖此参数可模拟单列列表场景 */
	minCardWidth?: number;
	/** 卡片间距（px）；默认 8 */
	gap?: number;
	/**
	 * 卡片总高度与宽度的比例（height / width）
	 * 包含封面 + 卡片 footer，用于估算每行高度。
	 * 默认 1.6（封面约 1:1 + footer 约 60px）
	 */
	avgCardRatio?: number;
	/** 缓冲倍数（额外加载视口外的数据），默认 1.5 */
	bufferMultiplier?: number;
	/** 最小返回值，默认 10 */
	min?: number;
	/** 最大返回值，默认 100 */
	max?: number;
}
/**
 * 估算首屏所需的数据条数
 *
 * 基于容器尺寸、列数和卡片比例进行粗略估算，
 * 用于在 FeedStore 发起首次请求前计算合适的 needNum，
 * 避免请求过少导致白屏、过多导致带宽浪费。
 *
 * 实际卡片高度将由 ResizeObserver 实测并修正，
 * 此函数仅负责"足够好"的初始估算。
 *
 * @param params - 估算参数
 * @returns 建议的请求数量
 */
export function estimateNeedNum(
	contentType: 'waterfall' | 'list',
	params: EstimateNeedNumParams
): number {
	const {
		containerWidth,
		containerHeight,
		minCardWidth = 160,
		gap: gapInput = 8,
		avgCardRatio = 1.6,
		bufferMultiplier = 1.5,
		min = 10,
		max = 100
	} = params;

	if (containerWidth <= 0 || containerHeight <= 0) return min;

	const gap = contentType === 'waterfall' ? gapInput : 0;
	const { columnCount, cardWidth } =
		contentType === 'waterfall'
			? calculateLayoutBase(containerWidth, minCardWidth, gap)
			: { columnCount: 1, cardWidth: containerWidth };
	// 单张卡片的平均总高度（含 gap）
	const avgCardHeight = cardWidth * avgCardRatio + gap;
	// 视口内可见行数
	const visibleRows = Math.ceil(containerHeight / avgCardHeight);
	// 含缓冲区的总估算量
	const raw = visibleRows * columnCount * bufferMultiplier;

	return Math.max(min, Math.min(max, Math.ceil(raw)));
}
