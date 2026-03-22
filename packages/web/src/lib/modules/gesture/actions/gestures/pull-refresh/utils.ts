/**
 * @file 下拉刷新手势工具函数
 * @description 弹性位移公式等仅 pull-refresh 使用的计算逻辑。
 */

import type { PullRefreshConfig } from './types';

// ─── 弹性位移 ────────────────────────────────────────────────────

/**
 * iOS UIScrollView "Rubber Banding" 弹性位移公式
 *
 * 公式：y = (1.0 - 1.0 / ((x * c / d) + 1.0)) * d
 * 渐近线为 d，随 x 增大 y 逼近 d 但不超过。
 *
 * @param rawDistance - 原始拖动距离（px）
 * @param config - 下拉刷新配置，提供 maxDistance / elasticCoefficient / elasticDimensionMultiplier
 * @returns 弹性映射后的视觉位移（px）
 */
export function calculateElasticDistance(rawDistance: number, config: PullRefreshConfig): number {
	const d = config.maxDistance * config.elasticDimensionMultiplier;
	const c = config.elasticCoefficient;
	return (1.0 - 1.0 / ((rawDistance * c) / d + 1.0)) * d;
}
