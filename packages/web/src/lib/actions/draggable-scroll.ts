/**
 * 鼠标拖动滚动 Action
 *
 * 使元素支持通过鼠标拖动来滚动内容
 *
 * @example
 * ```svelte
 * <nav use:draggableScroll={{ direction: 'horizontal' }}>
 *   <!-- 内容 -->
 * </nav>
 * ```
 */

export interface DraggableScrollOptions {
	/**
	 * 滚动方向
	 * @default 'horizontal'
	 */
	direction?: 'horizontal' | 'vertical' | 'both';

	/**
	 * 拖动阈值（像素），超过此距离才认为是拖动而不是点击
	 * @default 5
	 */
	dragThreshold?: number;

	/**
	 * 滚动速度系数
	 * @default 1
	 */
	scrollSpeed?: number;

	/**
	 * 光标样式
	 * @default 'grab'
	 */
	cursor?: 'grab' | 'grabbing' | 'move';

	/**
	 * 是否启用拖动滚动
	 * @default true
	 */
	enabled?: boolean;

	/**
	 * 拖动开始时的回调
	 */
	onDragStart?: () => void;

	/**
	 * 拖动结束时的回调
	 */
	onDragEnd?: () => void;

	/**
	 * 判断是否应该阻止点击事件
	 * 返回 true 则阻止点击，返回 false 则允许点击
	 * @param hasMoved 是否发生了拖动
	 */
	shouldPreventClick?: (hasMoved: boolean) => boolean;
}

const DEFAULT_OPTIONS: Required<
	Omit<DraggableScrollOptions, 'onDragStart' | 'onDragEnd' | 'shouldPreventClick'>
> = {
	direction: 'horizontal',
	dragThreshold: 5,
	scrollSpeed: 1,
	cursor: 'grab',
	enabled: true
};

export function draggableScroll(
	node: HTMLElement,
	options: DraggableScrollOptions = {}
): { update?: (options: DraggableScrollOptions) => void; destroy?: () => void } {
	// 合并默认配置
	const config = {
		...DEFAULT_OPTIONS,
		...options
	};

	// 状态管理
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let scrollLeft = 0;
	let scrollTop = 0;
	let hasMoved = false;

	// 全局事件监听器
	let globalMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
	let globalMouseUpHandler: (() => void) | null = null;

	// 鼠标按下事件
	function handleMouseDown(e: MouseEvent) {
		// 检查是否启用
		if (!config.enabled) return;

		// 只处理左键
		if (e.button !== 0) return;

		isDragging = true;
		hasMoved = false;

		// 计算初始位置
		const rect = node.getBoundingClientRect();
		startX = e.pageX - rect.left;
		startY = e.pageY - rect.top;
		scrollLeft = node.scrollLeft;
		scrollTop = node.scrollTop;

		// 更新样式
		node.style.cursor = config.cursor === 'grab' ? 'grabbing' : config.cursor;
		node.style.userSelect = 'none';

		// 添加全局事件监听器
		globalMouseMoveHandler = (moveEvent: MouseEvent) => {
			handleMouseMove(moveEvent);
		};
		globalMouseUpHandler = () => {
			handleMouseUp();
		};

		document.addEventListener('mousemove', globalMouseMoveHandler);
		document.addEventListener('mouseup', globalMouseUpHandler);

		// 触发回调
		config.onDragStart?.();
	}

	// 鼠标移动事件
	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;

		e.preventDefault();

		// 计算当前位置
		const rect = node.getBoundingClientRect();
		const x = e.pageX - rect.left;
		const y = e.pageY - rect.top;

		// 计算移动距离
		const deltaX = x - startX;
		const deltaY = y - startY;

		// 判断是否超过阈值
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		if (distance > config.dragThreshold) {
			hasMoved = true;
		}

		// 根据方向更新滚动位置
		if (config.direction === 'horizontal' || config.direction === 'both') {
			const walkX = deltaX * config.scrollSpeed;
			node.scrollLeft = scrollLeft - walkX;
		}

		if (config.direction === 'vertical' || config.direction === 'both') {
			const walkY = deltaY * config.scrollSpeed;
			node.scrollTop = scrollTop - walkY;
		}
	}

	// 鼠标释放事件
	function handleMouseUp() {
		if (!isDragging) return;

		isDragging = false;

		// 恢复样式
		node.style.cursor = config.cursor;
		node.style.userSelect = '';

		// 移除全局事件监听器
		if (globalMouseMoveHandler) {
			document.removeEventListener('mousemove', globalMouseMoveHandler);
			globalMouseMoveHandler = null;
		}
		if (globalMouseUpHandler) {
			document.removeEventListener('mouseup', globalMouseUpHandler);
			globalMouseUpHandler = null;
		}

		// 延迟重置 hasMoved，确保点击事件能正确判断
		setTimeout(() => {
			hasMoved = false;
		}, 50);

		// 触发回调
		config.onDragEnd?.();
	}

	// 鼠标离开事件
	function handleMouseLeave() {
		// 如果鼠标移出且没有全局监听器，手动清理
		if (isDragging && !globalMouseMoveHandler) {
			handleMouseUp();
		}
	}

	// 处理子元素点击事件（用于阻止拖动后的点击）
	function handleClick(e: MouseEvent) {
		const shouldPrevent = config.shouldPreventClick
			? config.shouldPreventClick(hasMoved)
			: hasMoved;

		if (shouldPrevent) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	// 绑定事件
	node.addEventListener('mousedown', handleMouseDown);
	node.addEventListener('mouseleave', handleMouseLeave);

	// 为所有子元素添加点击处理（可选）
	// 注意：这可能会影响性能，如果子元素很多的话
	// 更好的方式是在需要阻止点击的元素上手动添加处理
	node.addEventListener('click', handleClick, true); // 使用捕获阶段

	// 更新函数：当 options 变化时更新配置
	function update(newOptions: DraggableScrollOptions = {}) {
		// 如果正在拖动，先结束拖动
		if (isDragging) {
			handleMouseUp();
		}

		// 更新配置
		Object.assign(config, DEFAULT_OPTIONS, newOptions);

		// 更新光标样式
		if (!isDragging) {
			node.style.cursor = config.cursor;
		}
	}

	// 清理函数
	function destroy() {
		// 如果正在拖动，先结束拖动
		if (isDragging) {
			handleMouseUp();
		}

		// 移除事件监听器
		node.removeEventListener('mousedown', handleMouseDown);
		node.removeEventListener('mouseleave', handleMouseLeave);
		node.removeEventListener('click', handleClick, true);

		// 恢复样式
		node.style.cursor = '';
		node.style.userSelect = '';
	}

	// 初始化样式
	node.style.cursor = config.cursor;

	return {
		update,
		destroy
	};
}
