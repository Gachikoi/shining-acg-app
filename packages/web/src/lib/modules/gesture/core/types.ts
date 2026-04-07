/**
 * @file 手势系统公共类型定义
 * @description
 * GestureArena 竞技场、边界让渡与动画保护所需的公共类型。
 * 各手势专属类型见对应子目录：swipe/types、feed-stream/types、scroll-boundary/types、edge-zone/types。
 */

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
 * @property type - 手势类型标识（如 'swipe'、'feed-stream'）
 * @property node - 绑定了该手势的 DOM 节点
 * @property axis - 手势主轴
 * @property direction - 移动方向：正值表示坐标增大方向（右 / 下），负值反之
 * @property pointerTarget - 指针事件的原始 target，用于判断是否落在子级可滚动区域内
 * @property startX - 指针按下时的 clientX（可选），用于边缘区域优先判断
 * @property startY - 指针按下时的 clientY（可选），用于边缘区域优先判断
 */
export interface AcquireParams {
	id: string;
	type: string;
	node: HTMLElement;
	axis: Axis;
	direction: number;
	pointerTarget: HTMLElement;
	/** 指针按下时的 clientX，用于边缘区域优先：子手势在父级边缘区触摸时被拒绝 */
	startX?: number;
	/** 指针按下时的 clientY，用于边缘区域优先：子手势在父级边缘区触摸时被拒绝 */
	startY?: number;
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
 * @property id - 发起动画的手势实例唯一 ID，用于实例级隔离打断
 * @property owner - 发起动画的手势类型（如 'swipe'），保留用于日志/调试
 * @property interruptible - 是否可被同一实例的新手势打断
 * @property cancel - 打断回调：立即停止动画，将 Spring 冻结在当前值
 * @property finished - 动画自然完成时 resolve 的 Promise
 */
export interface AnimationToken {
	id: string;
	owner: string;
	interruptible: boolean;
	finished: Promise<void>;
}
