// ─── 速度跟踪 ────────────────────────────────────────────────────

/** 速度跟踪器内部采样点 */
export interface VelocitySample {
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

/** Pointer 通道状态机阶段 */
export type PointerPhase = 'idle' | 'pending' | 'active';

/**
 * 单个指针的轨迹（用于多指接手时 delta 连续）
 *
 * 每指一对速度跟踪器，与 `createVelocityTracker` 的 `getVelocity()` 语义一致（px/ms），
 * 用于多指时按横向瞬时速度选举主导 pointer。
 */
export interface PointerTrack {
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	/** 该 pointer 的横向速度采样；通过 {@link VelocityTracker.getVelocity} 读取瞬时 vx */
	trackerX: VelocityTracker;
	/** 该 pointer 的纵向速度采样；通过 {@link VelocityTracker.getVelocity} 读取瞬时 vy */
	trackerY: VelocityTracker;
}

/** Wheel 通道状态机阶段 */
export type WheelPhase = 'idle' | 'active';
