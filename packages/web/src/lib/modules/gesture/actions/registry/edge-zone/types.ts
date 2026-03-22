/**
 * @file 边缘优先区域类型定义
 * @description use:edgeZone Action 所需的 EdgeZoneOptions。
 */

import type { Axis } from '../../../core/types';

// ─── EdgeZone 声明 ────────────────────────────────────────────────

/**
 * use:edgeZone Action 配置选项
 *
 * @property width - 边缘区域宽度（px）
 * @property axis - 边缘区域生效的主轴（只有同轴手势才会被拦截）
 */
export interface EdgeZoneOptions {
	width: number;
	axis: Axis;
}
