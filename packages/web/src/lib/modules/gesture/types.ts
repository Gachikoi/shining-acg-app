/**
 * @file 手势系统共享类型定义
 * @description
 * GestureArena 竞技场、各手势识别器（swipe / pullRefresh / scrollBoundary）
 * 以及动画生命周期管理所需的全部公共类型。
 */

import type { Spring } from 'svelte/motion';

// ─── 基础类型 ─────────────────────────────────────────────────────

/** 坐标轴 */
export type Axis = 'x' | 'y';

/** 手势事件来源 */
export type GestureSource = 'pointer' | 'wheel';

// ─── GestureArena 竞技场 ─────────────────────────────────────────

/**
 * 手势识别器向竞技场申请控制权时传入的参数
 *
 * @property id - 识别器实例唯一 ID
 * @property type - 手势类型标识（如 'swipe'、'pull-refresh'）
 * @property node - 绑定了该手势的 DOM 节点
 * @property axis - 手势主轴
 * @property direction - 移动方向：正值表示坐标增大方向（右 / 下），负值反之
 * @property pointerTarget - 指针事件的原始 target，用于判断是否落在子级可滚动区域内
 */
export interface AcquireParams {
	id: string;
	type: string;
	node: HTMLElement;
	axis: Axis;
	direction: number;
	pointerTarget: HTMLElement;
}

/**
 * 可滚动边界区域登记信息
 *
 * @property axis - 该区域可滚动的轴向
 * @property canScroll - 实时查询：在指定轴和方向上是否还有滚动余量
 */
export interface ScrollBoundaryEntry {
	axis: Axis | 'both';
	canScroll: (axis: Axis, direction: number) => boolean;
}

/**
 * 手势后衔接动画的令牌
 *
 * @property owner - 发起动画的手势类型（如 'swipe'）
 * @property interruptible - 是否可被同类型手势打断
 * @property cancel - 打断回调：立即停止动画，将 Spring 冻结在当前值
 * @property finished - 动画自然完成时 resolve 的 Promise
 */
export interface AnimationToken {
	owner: string;
	interruptible: boolean;
	cancel: () => void;
	finished: Promise<void>;
}

// ─── Swipe 手势 ──────────────────────────────────────────────────

/**
 * 滑动过程/结束时传递给回调的状态快照
 *
 * @property deltaX - 相对起始位置的水平偏移（px）
 * @property velocityX - 水平瞬时速度（px/ms）
 * @property direction - 滑动方向
 * @property committed - 是否达到提交阈值（距离或速度）
 * @property source - 本次手势的事件来源
 */
export interface SwipeState {
	deltaX: number;
	velocityX: number;
	direction: 'left' | 'right';
	committed: boolean;
	source: GestureSource;
}

/**
 * use:swipe Action 配置选项
 *
 * @property threshold - 方向锁定阈值（px），超过后判定主轴。默认 10
 * @property commitThreshold - 提交切换的距离比例（相对容器宽度）。默认 0.25
 * @property velocityThreshold - 提交切换的速度阈值（px/ms）。默认 0.3
 * @property disabled - 动态禁用检查函数
 * @property interruptible - 手势后动画是否可被同类型打断。默认 true
 * @property onStart - 手势开始回调
 * @property onMove - 手势移动回调，每帧最多触发一次
 * @property onEnd - 手势结束回调，可返回 Promise 用于动画等待
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

// ─── ScrollBoundary 声明 ─────────────────────────────────────────

/**
 * use:scrollBoundary Action 配置选项
 *
 * @property axis - 该可滚动区域的滚动轴向。默认 'both'
 */
export interface ScrollBoundaryOptions {
	axis?: Axis | 'both';
}

// ─── Tap 手势 ────────────────────────────────────────────────────

/**
 * Tap 触发时传递给回调的细节
 *
 * @property target - pointerup 时的事件 target
 * @property currentTarget - 绑定 action 的节点
 * @property clientX - 指针坐标（viewport）
 * @property clientY - 指针坐标（viewport）
 * @property pointerType - 指针类型（mouse / touch / pen）
 */
export interface TapDetail {
	target: EventTarget | null;
	currentTarget: HTMLElement;
	clientX: number;
	clientY: number;
	pointerType: string;
}

/**
 * use:tap Action 配置选项
 *
 * @property threshold - 判定为移动/拖拽的阈值（px）。默认 8
 * @property maxDuration - 最大按下到抬起时长（ms）。默认 350
 * @property disabled - 动态禁用检查函数
 * @property excludeSelector - 命中该选择器的 target 将被忽略（常用于按钮/控件区）
 * @property onTap - 轻击回调
 */
export interface TapOptions {
	threshold?: number;
	maxDuration?: number;
	disabled?: () => boolean;
	excludeSelector?: string;
	onTap?: (detail: TapDetail) => void;
}

// ─── LongPress 手势 ───────────────────────────────────────────────

/**
 * LongPress 触发时传递给回调的细节
 *
 * @property target - 触发时的事件 target（pointerdown 的 target）
 * @property currentTarget - 绑定 action 的节点
 * @property clientX - 指针坐标（viewport）
 * @property clientY - 指针坐标（viewport）
 * @property x - 指针在 currentTarget 内的相对 X（px）
 * @property y - 指针在 currentTarget 内的相对 Y（px）
 * @property pointerType - 指针类型（mouse / touch / pen）
 */
export interface LongPressDetail {
	target: EventTarget | null;
	currentTarget: HTMLElement;
	clientX: number;
	clientY: number;
	x: number;
	y: number;
	pointerType: string;
}

/**
 * use:longPress Action 配置选项
 *
 * @property delay - 长按触发延迟（ms）。默认 450
 * @property threshold - 判定为移动/拖拽的阈值（px）。默认 10
 * @property touchOnly - 仅触摸设备触发（pointerType === 'touch'）。默认 false
 * @property disabled - 动态禁用检查函数
 * @property excludeSelector - 命中该选择器的 target 将被忽略
 * @property onPress - 长按触发回调
 * @property onPressUp - 长按触发后松手回调
 */
export interface LongPressOptions {
	delay?: number;
	threshold?: number;
	touchOnly?: boolean;
	disabled?: () => boolean;
	excludeSelector?: string;
	onPress?: (detail: LongPressDetail) => void;
	onPressUp?: () => void;
}
