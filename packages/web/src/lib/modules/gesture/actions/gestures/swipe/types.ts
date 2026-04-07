/**
 * @file 水平 / 纵向滑动手势类型定义
 * @description use:swipe Action 所需的 SwipeState、SwipeOptions 等类型。
 */

import type { GestureSource } from '../../../core/types';

// ─── Swipe 手势 ──────────────────────────────────────────────────

/** 主轴为横向时的滑动方向 */
export type SwipeHorizontalDirection = 'left' | 'right';

/** 主轴为纵向时的滑动方向 */
export type SwipeVerticalDirection = 'up' | 'down';

/**
 * 滑动过程/结束时传递给回调的状态快照
 *
 * 主轴由 `SwipeOptions.axis` 决定：`x` 时方向为 left/right，`y` 时为 up/down。
 *
 * @property deltaX - 相对起始位置的水平偏移（px）
 * @property deltaY - 相对起始位置的垂直偏移（px）
 * @property velocityX - 水平瞬时速度（px/ms）
 * @property velocityY - 垂直瞬时速度（px/ms）
 * @property direction - 滑动方向（基于主轴）
 * @property committed - 是否达到提交阈值（距离或速度）
 * @property commitTriggeredBy - 触发 `committed=true` 的原因；`onMove` 阶段或未提交时为 `null`
 * @property source - 本次手势的事件来源
 * @property endPointerTarget - 指针通道正常结束时 pointerup 的 `event.target`；wheel / cancel 等路径不设
 */
export interface SwipeState {
	deltaX: number;
	deltaY: number;
	velocityX: number;
	velocityY: number;
	direction: SwipeHorizontalDirection | SwipeVerticalDirection;
	committed: boolean;
	/**
	 * 触发 `committed=true` 的原因。
	 * - `'velocity'`：瞬时速度超过 `velocityThreshold`
	 * - `'displacement'`：位移比例超过 `commitThreshold`（pointer 通道），或累计位移超过阈值（wheel 通道）
	 * - `null`：未提交（`committed=false`），或处于 `onMove` 跟手阶段（尚无提交决策）
	 */
	commitTriggeredBy: 'velocity' | 'displacement' | null;
	source: GestureSource;
	endPointerTarget?: EventTarget | null;
}

/**
 * use:swipe Action 配置选项
 *
 * @property axis - 手势主轴：`x` 为横向（默认），`y` 为纵向；样式见 `swipe.svelte.ts` 内 `applyAxisStyles`
 * @property threshold - 方向锁定阈值（px）
 * @property commitThreshold - 提交切换的距离比例（相对容器**宽度**或**高度**，随 axis 变化）
 * @property velocityThreshold - 提交切换的速度阈值（px/ms）
 * @property disabled - 动态禁用
 * @property interruptible - 手势后动画是否可被同类型打断
 * @property onStart - 手势开始
 * @property onMove - 跟手
 * @property onEnd - 结束
 */
export interface SwipeOptions {
	axis?: 'x' | 'y';
	threshold?: number;
	commitThreshold?: number;
	velocityThreshold?: number;
	disabled?: () => boolean;
	interruptible?: boolean;
	onStart?: () => void;
	onMove?: (state: SwipeState) => void;
	onEnd?: (state: SwipeState) => Promise<void> | void;
}
