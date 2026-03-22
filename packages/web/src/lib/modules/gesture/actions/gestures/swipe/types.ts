/**
 * @file 水平滑动手势类型定义
 * @description use:swipe Action 所需的 SwipeState、SwipeOptions 等类型。
 */

import type { GestureSource } from '../../../core/types';

// ─── Swipe 手势 ──────────────────────────────────────────────────

/**
 * 滑动过程/结束时传递给回调的状态快照
 *
 * 虽然 swipe 以水平轴为主轴（方向锁定基于 |dx| > |dy|），
 * 但副轴（deltaY / velocityY）也会透传，供消费端做视觉联动
 * （如 stack-item 右滑时同步调整 scale / translateY）。
 *
 * @property deltaX - 相对起始位置的水平偏移（px）
 * @property deltaY - 相对起始位置的垂直偏移（px），副轴信息
 * @property velocityX - 水平瞬时速度（px/ms）
 * @property velocityY - 垂直瞬时速度（px/ms），副轴信息
 * @property direction - 滑动方向（基于主轴）
 * @property committed - 是否达到提交阈值（距离或速度）
 * @property velocityThresholdUsed - 本帧使用的速度阈值（px/ms），来自 SwipeOptions.velocityThreshold，供消费端做方向相关判断
 * @property source - 本次手势的事件来源
 */
export interface SwipeState {
	deltaX: number;
	deltaY: number;
	velocityX: number;
	velocityY: number;
	direction: 'left' | 'right';
	committed: boolean;
	/** 本帧使用的速度阈值（px/ms），与 SwipeOptions.velocityThreshold 一致，便于消费端做「速度超过阈值」判断而不重复写常量 */
	velocityThresholdUsed: number;
	source: GestureSource;
}

/**
 * use:swipe Action 配置选项
 *
 * @property threshold - 方向锁定阈值（px），超过后判定主轴。默认 10
 * @property commitThreshold - 提交切换的距离比例（相对容器宽度）。默认 0.25
 * @property velocityThreshold - 提交切换的速度阈值（px/ms）。默认 0.3
 * @property disabled - 动态禁用检查函数，为 true 时不会触发新手势，可以在 onEnd 无法返回 Promise 又希望保护动画不被打断时使用。
 * @property interruptible - 手势后动画是否可被同类型打断。默认 true
 * @property onStart - 手势开始回调
 * @property onMove - 手势移动回调，每帧最多触发一次
 * @property onEnd - 手势结束回调。如果不返回 Promise，则不会保护动画不被打断；如果返回 Promise，则动画根据 interruptible 决定是否可被打断。WAAPI 动画可以返回 .finished 属性用于等待动画。
 */
export interface SwipeOptions {
	threshold?: number;
	commitThreshold?: number;
	velocityThreshold?: number;
	disabled?: () => boolean;
	interruptible?: boolean;
	onStart?: () => void;
	onMove?: (state: SwipeState) => void;
	onEnd?: (state: SwipeState) => Promise<void> | void;
}
