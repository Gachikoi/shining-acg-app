/**
 * @file 手势系统工具函数
 * @description
 * 弹性位移公式、速度跟踪器、wheel 事件标准化等通用计算逻辑。
 * 所有函数均为纯函数或轻量工厂，无副作用。
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

// ─── 速度跟踪 ────────────────────────────────────────────────────

/** 速度跟踪器内部采样点 */
interface VelocitySample {
	/** 时间戳（ms） */
	time: number;
	/** 坐标值（px） */
	value: number;
}

/**
 * 速度跟踪器
 *
 * 维护最近 N 个采样点，基于最旧/最新两点的差值计算平均速度。
 * 适用于 60~120Hz 设备上的平滑速度估算。
 */
export interface VelocityTracker {
	/** 添加采样点 */
	addSample: (value: number) => void;
	/** 获取当前速度（px/ms），无足够采样时返回 0 */
	getVelocity: () => number;
	/** 重置所有采样 */
	reset: () => void;
}

/**
 * 创建速度跟踪器
 *
 * @param maxSamples - 最大保留采样数，默认 5
 * @returns VelocityTracker 实例
 */
export function createVelocityTracker(maxSamples = 5): VelocityTracker {
	let samples: VelocitySample[] = [];

	return {
		addSample(value: number) {
			const now = performance.now();
			samples.push({ time: now, value });
			if (samples.length > maxSamples) {
				samples = samples.slice(-maxSamples);
			}
		},

		getVelocity(): number {
			if (samples.length < 2) return 0;
			const oldest = samples[0];
			const newest = samples[samples.length - 1];
			const dt = newest.time - oldest.time;
			if (dt <= 0) return 0;
			return (newest.value - oldest.value) / dt;
		},

		reset() {
			samples = [];
		}
	};
}

// ─── Wheel 事件标准化 ────────────────────────────────────────────

/**
 * 标准化 wheel 事件的 delta 值为像素
 *
 * 不同浏览器和输入设备的 deltaMode 不同：
 * - 0 (DOM_DELTA_PIXEL)：已经是像素
 * - 1 (DOM_DELTA_LINE)：按行计，乘以典型行高 40px
 * - 2 (DOM_DELTA_PAGE)：按页计，乘以典型页高 800px
 *
 * @param event - WheelEvent
 * @returns 标准化后的 { deltaX, deltaY }（均为像素）
 */
export function normalizeWheelDelta(event: WheelEvent): { deltaX: number; deltaY: number } {
	let { deltaX, deltaY } = event;
	if (event.deltaMode === 1) {
		deltaX *= 40;
		deltaY *= 40;
	} else if (event.deltaMode === 2) {
		deltaX *= 800;
		deltaY *= 800;
	}
	return { deltaX, deltaY };
}

// ─── ID 生成 ─────────────────────────────────────────────────────

/** 自增计数器，用于生成竞技场内唯一的识别器 ID */
let idCounter = 0;

/**
 * 生成唯一识别器 ID
 *
 * @param prefix - ID 前缀（如 'swipe'、'pull-refresh'）
 * @returns 格式为 `${prefix}-${counter}` 的唯一字符串
 */
export function generateId(prefix: string): string {
	return `${prefix}-${++idCounter}`;
}
