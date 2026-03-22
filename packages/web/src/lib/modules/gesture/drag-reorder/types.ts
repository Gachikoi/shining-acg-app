/**
 * @file 拖拽重排手势 — 配置类型
 * @description
 * `dragReorder` Action 的选项：列表由 `getItemElements` 描述，与业务数组下标一一对应。
 */

/**
 * `use:dragReorder` 的配置
 *
 * @remarks
 * - **拖拽源**：Action 绑在手柄等任意子节点，不必等于列表项根节点。
 * - **竞技场**：开始拖拽时 `tryAcquire`，`axis: 'x'` 以便与父级纵向 `scrollBoundary` 共存；
 *   `getArenaNode` 应返回已注册 `scrollBoundary` 的**祖先**（否则回退 `listRoot` / `document.body`）。
 * - **索引**：`fromIndex` 在 `pointerdown` 时**快照**为本次拖拽起点；拖拽过程中 `update()` 可刷新 `fromIndex` 供其它实例使用，但不影响已开始的拖拽。`onReorder` 仅在松手且 `from !== to` 时调用。
 * - **跟手虚影**：可选 `dragPreview`；由 Action 挂到 `document.body`，松手 / `destroy` / `finally` 中必定移除。
 */

/**
 * 拖拽时跟手的克隆预览（当前仅 `clone-list-item`）
 */
export type DragReorderDragPreview = {
	mode: 'clone-list-item';
	/** 克隆根节点透明度，默认约 0.88 */
	opacity?: number;
	/**
	 * `z-index`，须高于页面内浮层（如 `z-50` 的菜单），默认 `60`
	 */
	zIndex?: number;
	/** 追加到克隆根上的 class（如 Tailwind 的 ring / shadow） */
	className?: string;
};

export interface DragReorderOptions {
	/**
	 * 返回当前列表项 DOM，**数组顺序**须与业务数据下标一致
	 *
	 * @remarks 建议在回调内 `querySelectorAll` 或收集绑定 ref，避免使用过期快照
	 */
	getItemElements: () => HTMLElement[];

	/**
	 * 当前手柄所在列表项在业务数组中的下标；实现内在 `pointerdown` 时冻结，不随中途 `update()` 改变本次拖拽的起点
	 */
	fromIndex: number;

	/**
	 * 拖拽成功结束（`pointerup`）且目标下标与起点不同时调用
	 *
	 * @param fromIndex - 移动前列表项下标
	 * @param toIndex - 指针落点解析得到的列表项下标
	 */
	onReorder: (fromIndex: number, toIndex: number) => void;

	/**
	 * 返回参与 `GestureArena.tryAcquire` 的 `node`：须**包含**页面中已 `registerScrollBoundary` 的滚动容器
	 *
	 * @remarks
	 * 典型做法：列表根 `closest('[data-your-scroll-marker]')` 指向带 `use:scrollBoundary` 的祖先。
	 * 若省略且未设 `listRoot`，则使用 `document.body`（通常仍能包含滚动区）。
	 */
	getArenaNode?: () => HTMLElement | null;

	/**
	 * 可选列表根，仅作 `getArenaNode` 为空时的竞技场 `node` 回退
	 */
	listRoot?: HTMLElement | null;

	/**
	 * 按下后指针移动超过该距离（px）才进入拖拽，避免轻触误拖
	 *
	 * @default 8
	 */
	activationThreshold?: number;

	/**
	 * 返回 `true` 时忽略指针（如上传中、只读态）
	 */
	disabled?: () => boolean;

	/**
	 * 若 `pointerdown` 的 `target` 匹配 `element.closest(selector)`，则不开始本次拖拽
	 *
	 * @remarks 用于整卡可拖时排除内部可点控件（如卡片内独立「更多」按钮）
	 */
	excludePointerDownSelector?: string;

	/**
	 * 已通过 `tryAcquire` 并进入拖拽态时调用（可用来做项透明度、阴影等）
	 */
	onDragStart?: () => void;

	/**
	 * 拖拽结束或取消时调用（与是否提交 `onReorder` 无关，只要曾进入 dragging 就会触发）
	 */
	onDragEnd?: () => void;

	/**
	 * 本次指针序列在 **`pointerup` 时仍未进入 `dragging`**（位移未达 `activationThreshold` 等）时调用
	 *
	 * @remarks 用于「整卡轻点打开菜单」等与拖拽互斥的轻触语义；**不会**在 `pointercancel` / `lostpointercapture` 的 pending 清理路径触发。
	 */
	onPendingPointerUp?: (event: PointerEvent) => void;

	/**
	 * 启用跟手虚影：克隆 `getItemElements()[dragFromIndex]`，`fixed` + `translate3d` 跟随指针
	 */
	dragPreview?: DragReorderDragPreview;
}
