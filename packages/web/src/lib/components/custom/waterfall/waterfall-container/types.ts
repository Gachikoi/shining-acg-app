/**
 * @file 瀑布流组件类型定义
 */

import type { PullRefreshConfig } from '$lib/modules/gesture';

// 重新导出本地布局模块的 CardPosition 类型，保持向后兼容
export type { CardPosition } from './waterfall-layout';

/**
 * 瀑布流配置项
 */
export interface WaterfallConfig {
	/** 最小卡片宽度（px），用于计算列数 */
	minCardWidth: number;
	/** 卡片间距（px），设为 0 时使用响应式间距 */
	gap: number;
	/** 虚拟列表缓冲区大小倍数 */
	bufferSize: number;
	/** 虚拟列表缓冲区基础高度（px） */
	bufferHeight: number;
	/** 触发加载更多的滚动距离阈值（px） */
	loadingThreshold: number;
	/** 骨架屏卡片数量 */
	skeletonCardCount: number;
	/** 使用二分查找的卡片数量阈值 */
	binarySearchThreshold: number;
	/** 下拉刷新配置 */
	pullRefreshConfig: PullRefreshConfig;
}
