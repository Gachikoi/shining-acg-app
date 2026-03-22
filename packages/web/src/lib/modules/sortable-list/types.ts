/**
 * @file sortable-list — 与 `sortableList` Svelte Action 配套的选项类型
 */

/**
 * `use:sortableList` 的配置
 */
export type SortableListActionOptions = {
	/** 可排序子节点的 CSS 选择器（相对列表根），如 `[data-sortable-item]` */
	itemSelector: string;
	/** 当前可排序项数量；为 0 时不创建实例 */
	itemCount: number;
	/**
	 * 列表顺序/内容的指纹（如 `urls.join('\\0')`）。变化时销毁并重建 Sortable，避免 Svelte 协调 DOM 后实例仍指向旧节点。
	 */
	orderKey: string;
	/** 为 true 时不创建实例（上传中等） */
	disabled?: () => boolean;
	/** 与 `reorderMedia(from,to)` 语义一致：`onEnd` 且下标有效且不同时调用 */
	onReorder: (fromIndex: number, toIndex: number) => void;
	/** Sortable `onStart`：参数为被拖动的根元素 */
	onDragStart?: (item: HTMLElement) => void;
	/** Sortable `onEnd` 末尾始终调用（含未换位、取消等） */
	onDragEnd?: () => void;
	/**
	 * 按住多久后开始拖动（ms）。配合 `delayOnTouchOnly` 时通常仅影响触摸，鼠标可立即拖。
	 *
	 * @default 450
	 */
	delay?: number;
	/**
	 * 为 true 时 `delay` 仅作用于触摸指针
	 *
	 * @default true
	 */
	delayOnTouchOnly?: boolean;
};
