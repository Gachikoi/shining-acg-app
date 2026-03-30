/**
 * @file 滚动边界声明类型定义
 * @description use:scrollBoundary Action 所需的 ScrollBoundaryOptions。
 */

import type { Axis } from '../../../core/types';

// ─── ScrollBoundary 声明 ─────────────────────────────────────────

/**
 * use:scrollBoundary Action 配置选项
 *
 * @property axis - 该可滚动区域的滚动轴向。默认 'both'
 * @property canScroll - 若提供，则替代基于 `scrollLeft` / `scrollTop` 的默认测量。
 *   用于 `overflow` 下无真实滚动位移、由 transform 等逻辑驱动的「虚拟」分页（如 SwipeablePane）。
 *   参数约定与内置实现一致：`direction` 正值为坐标增大方向（右/下）的指针位移。
 */
export interface ScrollBoundaryOptions {
	axis?: Axis | 'both';
	canScroll?: (queryAxis: Axis, direction: number) => boolean;
}
