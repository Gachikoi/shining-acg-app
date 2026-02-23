export interface ContextPopoverOptions {
	/**
	 * 是否阻止浏览器默认的右键菜单
	 * @default true
	 */
	preventDefault?: boolean;

	/**
	 * 触发回调（右键 / 长按触发的 contextmenu 事件）
	 */
	onTrigger?: (event: MouseEvent) => void;
}

export interface ContextPopoverEvents {
	contextpopover: CustomEvent<{ event: MouseEvent }>;
}

/**
 * 右键（contextmenu）触发 Popover 的通用 Action
 *
 * 使用方式：
 * <button
 *   use:contextPopover={{ onTrigger: (event) => { ... } }}
 *   on:contextpopover={(e) => { ...e.detail.event }}
 * />
 */
export function contextPopover(
	node: HTMLElement,
	options: ContextPopoverOptions = {}
): {
	update?: (options: ContextPopoverOptions) => void;
	destroy?: () => void;
} {
	let preventDefault = options.preventDefault ?? true;
	let onTrigger = options.onTrigger;

	function handleContextMenu(event: MouseEvent) {
		// 只响应鼠标右键触发的 contextmenu，避免左键长按等手势也弹出 Popover
		if (event.button !== 2) return;

		if (preventDefault) {
			event.preventDefault();
		}

		onTrigger?.(event);

		node.dispatchEvent(
			new CustomEvent('contextpopover', {
				detail: { event }
			})
		);
	}

	node.addEventListener('contextmenu', handleContextMenu);

	function update(newOptions: ContextPopoverOptions = {}) {
		preventDefault = newOptions.preventDefault ?? preventDefault;
		onTrigger = newOptions.onTrigger ?? onTrigger;
	}

	function destroy() {
		node.removeEventListener('contextmenu', handleContextMenu);
	}

	return {
		update,
		destroy
	};
}
