import type { LongPressOptions } from './long-press';
import { longPress } from './long-press';

type BaseLongPressOptions = Omit<LongPressOptions, 'onStart' | 'onMove' | 'onEnd'>;

export interface LongPressSortOptions<T> extends BaseLongPressOptions {
	/**
	 * 当前绑定到元素的项
	 */
	item: T;

	/**
	 * 获取当前列表
	 */
	getItems: () => T[];

	/**
	 * 更新列表顺序
	 */
	setItems: (items: T[]) => void;

	/**
	 * 排序方向
	 * @default 'horizontal'
	 */
	orientation?: 'horizontal' | 'vertical';

	/**
	 * 排序发生后回调（可用于持久化）
	 */
	onOrderChange?: (items: T[]) => void;

	/**
	 * 开始排序时回调（第一次发生有效移动时触发）
	 */
	onSortStart?: () => void;

	/**
	 * 结束排序时回调
	 */
	onSortEnd?: () => void;

	/**
	 * 长按结束时回调（在排序清理逻辑之后调用）
	 */
	onEnd?: LongPressOptions['onEnd'];
}

/**
 * 基于 longPress 的长按拖拽排序 Action
 *
 * 负责在长按后根据拖动方向调整列表中 item 的顺序：
 * - 横向：根据 clientX 与上一次的位置比较，决定与左/右相邻项交换
 * - 纵向：根据 clientY，与上/下相邻项交换
 *
 * 具体的列表读写与持久化由调用方通过 getItems/setItems/onOrderChange 控制。
 */
export function longPressSort<T>(
	node: HTMLElement,
	options: LongPressSortOptions<T>
): {
	update?: (options: LongPressSortOptions<T>) => void;
	destroy?: () => void;
} {
	let config: LongPressSortOptions<T> = {
		orientation: 'horizontal',
		...options
	};

	let isSorting = false;
	// 记录本次长按开始时的坐标 & 索引，用于根据总位移计算最终位置
	let startCoord = 0;
	let startIndex: number | null = null;
	// 估算单个 item 在主轴方向上的“步长”（宽度/高度 + gap）
	let itemStepSize = 0;

	function getMainCoord(event: MouseEvent | TouchEvent): number | null {
		const point =
			'touches' in event ? (event.touches[0] ?? event.changedTouches[0]) : (event as MouseEvent);
		if (!point) return null;
		return config.orientation === 'vertical' ? point.clientY : point.clientX;
	}

	function handleStart(event: MouseEvent | TouchEvent) {
		const coord = getMainCoord(event);
		if (coord == null) return;
		startCoord = coord;

		const items = config.getItems();
		startIndex = items.indexOf(config.item);

		// 在长按开始时估算一次当前 item 的“步长”
		const target = event.target as HTMLElement | null;
		const rect = target?.getBoundingClientRect?.();
		const parent = target?.parentElement ?? null;

		let gap = 0;
		if (parent) {
			const style = getComputedStyle(parent);
			const gapValue =
				config.orientation === 'vertical' ? (style.rowGap ?? '0') : (style.columnGap ?? '0');
			const parsed = parseFloat(gapValue);
			gap = Number.isNaN(parsed) ? 0 : parsed;
		}

		if (rect) {
			itemStepSize = (config.orientation === 'vertical' ? rect.height : rect.width) + (gap || 0);
		}

		// 兜底：如果无法拿到尺寸，退回到阈值作为步长
		if (!itemStepSize || itemStepSize <= 0) {
			itemStepSize = config.moveThreshold ?? 10;
		}
	}

	function handleMove(event: MouseEvent | TouchEvent) {
		const coord = getMainCoord(event);
		if (coord == null) return;

		const threshold = config.moveThreshold ?? 10;
		const totalDelta = coord - startCoord;

		// 一旦进入长按状态并开始移动，就认为进入「排序交互」状态，
		// 这样可以尽早通知外层禁用 draggableScroll，避免 PC 上横向拖动滚动抢占事件。
		if (!isSorting && Math.abs(totalDelta) >= threshold) {
			isSorting = true;
			config.onSortStart?.();
		}

		if (!isSorting) {
			return;
		}

		if (startIndex == null || !itemStepSize) {
			return;
		}

		const items = config.getItems();
		const currentIndex = items.indexOf(config.item);
		if (currentIndex === -1) return;

		// 根据“总位移 / 单步长度”计算目标索引，使按钮的大致位移和鼠标一致
		const rawSteps = totalDelta / itemStepSize;
		const clampedTargetIndex = Math.max(
			0,
			Math.min(items.length - 1, startIndex + Math.round(rawSteps))
		);

		if (clampedTargetIndex === currentIndex) {
			return;
		}

		const updated = [...items];
		const [moved] = updated.splice(currentIndex, 1);
		updated.splice(clampedTargetIndex, 0, moved);

		config.setItems(updated);
		config.onOrderChange?.(updated);
	}

	function handleEnd(
		event: MouseEvent | TouchEvent,
		context: { isLongPress: boolean; hasMoved: boolean }
	) {
		if (isSorting) {
			isSorting = false;
			startIndex = null;
			itemStepSize = 0;
			config.onSortEnd?.();
		}

		// 将长按结束回调透传给调用方
		config.onEnd?.(event, context);
	}

	const inner = longPress(node, {
		duration: config.duration,
		// 统一使用同一个 moveThreshold：
		// - 超过该值，视为「发生过明显拖动」，长按结束时不再弹出 Popover；
		// - 同时也作为排序触发的灵敏度（见 handleMove）。
		moveThreshold: config.moveThreshold,
		onStart: handleStart,
		onMove: handleMove,
		onEnd: handleEnd
	});

	function update(newOptions: LongPressSortOptions<T>) {
		config = {
			...config,
			...newOptions
		};

		inner.update?.({
			duration: config.duration,
			moveThreshold: config.moveThreshold,
			onStart: handleStart,
			onMove: handleMove,
			onEnd: handleEnd
		});
	}

	function destroy() {
		inner.destroy?.();
	}

	return {
		update,
		destroy
	};
}
