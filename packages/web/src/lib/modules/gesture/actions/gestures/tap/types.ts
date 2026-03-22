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
