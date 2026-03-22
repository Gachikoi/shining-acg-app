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
 */
export interface ScrollBoundaryOptions {
	axis?: Axis | 'both';
}
