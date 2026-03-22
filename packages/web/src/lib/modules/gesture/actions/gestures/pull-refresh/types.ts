/**
 * @file 下拉刷新手势类型定义
 * @description use:pullRefresh Action 所需的 PullRefreshConfig、PullRefreshOptions。
 */

import type { Spring } from 'svelte/motion';

// ─── PullRefresh 手势 ────────────────────────────────────────────

/**
 * 下拉刷新配置
 *
 * @property maxDistance - 最大下拉视觉距离（px）
 * @property triggerThreshold - 触发刷新的弹性位移阈值（px）
 * @property triggeredDistance - 触发后 pullDistance 固定到的距离（px），用于显示刷新指示器
 * @property elasticCoefficient - iOS Rubber Banding 弹性系数 c，越小起步阻力越大（推荐 0.1~0.5）
 * @property elasticDimensionMultiplier - 弹性饱和上限倍数：d = maxDistance × 此值
 */
export interface PullRefreshConfig {
	maxDistance: number;
	triggerThreshold: number;
	triggeredDistance: number;
	elasticCoefficient: number;
	elasticDimensionMultiplier: number;
}

/**
 * use:pullRefresh Action 配置选项
 *
 * @property pullDistance - 外部传入的 Spring 实例，action 通过它驱动视觉位移
 * @property config - 下拉刷新配置，不传则使用默认值
 * @property onRefresh - 刷新回调，action await 此函数并自动管理回弹
 * @property onPullingChange - 拉动状态变化通知
 */
export interface PullRefreshOptions {
	pullDistance: Spring<number>;
	config?: PullRefreshConfig;
	onRefresh: () => Promise<void>;
	onPullingChange?: (isPulling: boolean) => void;
}
