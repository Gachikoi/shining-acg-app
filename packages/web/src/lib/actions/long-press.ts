export interface LongPressOptions {
	/**
	 * 长按判定时间（毫秒）
	 * @default 400
	 */
	duration?: number;

	/**
	 * 视为“移动”的最小距离（像素）
	 * 超过这个距离会触发 move 事件
	 * @default 10
	 */
	moveThreshold?: number;

	/**
	 * 长按开始时回调
	 */
	onStart?: (event: MouseEvent | TouchEvent) => void;

	/**
	 * 长按移动时回调
	 */
	onMove?: (event: MouseEvent | TouchEvent, dx: number, dy: number) => void;

	/**
	 * 长按结束时回调
	 * @param event 原始事件
	 * @param context.isLongPress 是否真正进入过长按状态
	 * @param context.hasMoved 是否在长按状态下发生过移动
	 */
	onEnd?: (
		event: MouseEvent | TouchEvent,
		context: { isLongPress: boolean; hasMoved: boolean }
	) => void;
}

export interface LongPressEvents {
	longpressstart: CustomEvent<{ event: MouseEvent | TouchEvent }>;
	longpressmove: CustomEvent<{
		event: MouseEvent | TouchEvent;
		dx: number;
		dy: number;
	}>;
	longpressend: CustomEvent<{ event: MouseEvent | TouchEvent }>;
}

/**
 * 通用长按识别 Action
 *
 * 负责把鼠标/触摸的按下、移动、抬起封装成：
 * - longpressstart：达到长按时间阈值时触发
 * - longpressmove：长按状态下移动时持续触发
 * - longpressend：长按状态下松开时触发
 *
 * 不关心业务逻辑（弹出 Popover / 拖拽排序等），仅做交互识别。
 */
export function longPress(
	node: HTMLElement,
	options: LongPressOptions = {}
): {
	update?: (options: LongPressOptions) => void;
	destroy?: () => void;
} {
	let duration = options.duration ?? 400;
	let moveThreshold = options.moveThreshold ?? 10;
	let onStart = options.onStart;
	let onMove = options.onMove;
	let onEnd = options.onEnd;

	let timer: number | null = null;
	let pressed = false;
	let longPressed = false;
	let movedWhileLongPress = false;
	let startX = 0;
	let startY = 0;
	// 标记：当前这次交互已经进入过长按，需要阻止接下来的一次 click 导航
	let preventNextClick = false;

	function clearTimer() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function getPoint(event: MouseEvent | TouchEvent) {
		if ('touches' in event) {
			const touch = event.touches[0] ?? event.changedTouches[0];
			return touch ?? null;
		}
		return event;
	}

	function handleDown(event: MouseEvent | TouchEvent) {
		// 鼠标只处理左键
		if (event instanceof MouseEvent && event.button !== 0) return;

		const point = getPoint(event);
		if (!point) return;

		pressed = true;
		longPressed = false;
		movedWhileLongPress = false;
		startX = point.clientX;
		startY = point.clientY;

		clearTimer();
		timer = window.setTimeout(() => {
			longPressed = true;
			// 一旦真正进入长按态，本次交互不应再触发“普通点击”行为
			preventNextClick = true;
			onStart?.(event);
			node.dispatchEvent(
				new CustomEvent('longpressstart', {
					detail: { event }
				})
			);
		}, duration);
	}

	function handleMove(event: MouseEvent | TouchEvent) {
		if (!pressed) return;

		const point = getPoint(event);
		if (!point) return;

		const dx = point.clientX - startX;
		const dy = point.clientY - startY;
		const distance = Math.sqrt(dx * dx + dy * dy);

		// 在长按触发前，如果移动距离过大，则认为是正常滚动/拖动，取消长按判定
		if (!longPressed && distance > moveThreshold) {
			clearTimer();
			pressed = false;
			return;
		}

		// 长按状态下移动，持续派发 move 事件
		if (longPressed) {
			movedWhileLongPress = movedWhileLongPress || distance > moveThreshold;
			onMove?.(event, dx, dy);
			node.dispatchEvent(
				new CustomEvent('longpressmove', {
					detail: { event, dx, dy }
				})
			);
		}
	}

	function handleUp(event: MouseEvent | TouchEvent) {
		if (!pressed && !longPressed) return;

		// 只有真正进入过长按状态时才派发 end
		if (longPressed) {
			onEnd?.(event, { isLongPress: true, hasMoved: movedWhileLongPress });
			node.dispatchEvent(
				new CustomEvent('longpressend', {
					detail: { event }
				})
			);
		}

		clearTimer();
		pressed = false;
		longPressed = false;
		movedWhileLongPress = false;
	}

	function handleClick(event: MouseEvent) {
		// 如果本次交互已经被识别为长按，则拦截随后的 click，
		// 避免例如 <a> 标签发生导航，从而只保留“排序/弹出 Popover”等长按行为。
		if (preventNextClick) {
			event.preventDefault();
			event.stopPropagation();
			preventNextClick = false;
		}
	}

	node.addEventListener('mousedown', handleDown);
	node.addEventListener('touchstart', handleDown, { passive: true });
	node.addEventListener('mousemove', handleMove);
	node.addEventListener('touchmove', handleMove, { passive: false });
	node.addEventListener('mouseup', handleUp);
	node.addEventListener('mouseleave', handleUp);
	node.addEventListener('touchend', handleUp);
	node.addEventListener('touchcancel', handleUp);
	// 使用捕获阶段尽量早地拦截 click，避免被框架路由等监听到
	node.addEventListener('click', handleClick, true);

	function update(newOptions: LongPressOptions = {}) {
		duration = newOptions.duration ?? duration;
		moveThreshold = newOptions.moveThreshold ?? moveThreshold;
		onStart = newOptions.onStart ?? onStart;
		onMove = newOptions.onMove ?? onMove;
		onEnd = newOptions.onEnd ?? onEnd;
	}

	function destroy() {
		clearTimer();
		node.removeEventListener('mousedown', handleDown);
		node.removeEventListener('touchstart', handleDown);
		node.removeEventListener('mousemove', handleMove);
		node.removeEventListener('touchmove', handleMove);
		node.removeEventListener('mouseup', handleUp);
		node.removeEventListener('mouseleave', handleUp);
		node.removeEventListener('touchend', handleUp);
		node.removeEventListener('touchcancel', handleUp);
		node.removeEventListener('click', handleClick, true);
	}

	return {
		update,
		destroy
	};
}
