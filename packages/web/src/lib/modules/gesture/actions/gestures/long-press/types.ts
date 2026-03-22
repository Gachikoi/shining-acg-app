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
