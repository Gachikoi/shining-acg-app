/**
 * @file 水平滑动手势工具函数
 * @description 速度跟踪器等仅 swipe 使用的计算逻辑。
 */

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
 * 可选：窗口速度低于噪声地板时折叠为单点，避免停顿后历史位移仍算出非零速度。
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
 * 每次 addSample 后若 |窗口速度| 低于 getClearBelowVelocity()，则折叠为仅保留最新点，
 * 使手指停住后不再携带「早先快速拖动」的惯性速度，符合停顿直觉。
 *
 * @param maxSamples - 最大保留采样数，默认 5
 * @param getClearBelowVelocity - 可选；返回近零清除阈值（px/ms），未传时内部默认 0.05 px/ms
 * @returns VelocityTracker 实例
 */
export function createVelocityTracker(): VelocityTracker {
	let samples: VelocitySample[] = [];

	/**
	 * 根据首尾采样计算窗口平均速度（与对外 getVelocity 一致）
	 *
	 * @param buf - 当前采样缓冲
	 * @returns 速度（px/ms）；不足两点或 dt<=0 时返回 null（调用方跳过折叠）
	 */
	function computeWindowVelocity(buf: VelocitySample[]): number | null {
		if (buf.length < 2) return null;
		const oldest = buf[0];
		const newest = buf[buf.length - 1];
		const dt = newest.time - oldest.time;
		if (dt <= 0) return null;
		return (newest.value - oldest.value) / dt;
	}

	return {
		addSample(value: number) {
			const now = performance.now();
			samples.push({ time: now, value });
			// 算瞬时速度，而不是平均速度，两个点就够了
			if (samples.length > 2) {
				samples = samples.slice(-2);
			}
		},

		getVelocity(): number {
			const v = computeWindowVelocity(samples);
			return v ?? 0;
		},

		reset() {
			samples = [];
		}
	};
}
