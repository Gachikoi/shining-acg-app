/**
 * @file 边缘优先区域类型定义
 * @description use:edgeZone Action 所需的 EdgeZoneOptions。
 */

// ─── EdgeZone 声明 ────────────────────────────────────────────────

/**
 * use:edgeZone Action 配置选项：从元素四边向内延伸的条带宽度（px）。
 *
 * - 水平手势（`axis === 'x'`）只与 **left / right** 条带相交时触发边缘让渡。
 * - 垂直手势（`axis === 'y'`）只与 **top / bottom** 条带相交时触发边缘让渡。
 * - 未设置或 0 表示该边不声明边缘区。
 *
 * @property left - 左缘向内宽度（px）
 * @property right - 右缘向内宽度（px）
 * @property top - 上缘向内宽度（px）
 * @property bottom - 下缘向内宽度（px）
 */
export interface EdgeZoneOptions {
	left?: number;
	right?: number;
	top?: number;
	bottom?: number;
}
