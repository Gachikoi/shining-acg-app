/**
 * @file 水平滑动手势 Svelte Action
 * @description
 * 检测触摸/指针设备上的水平滑动手势，用于 Tab 面板切换等场景。
 *
 * 核心特性：
 * - 方向锁定：首次移动超过阈值后锁定为水平或垂直，避免斜向拖动的歧义
 * - 速度计算：基于最后几帧的移动速度判断是否应提交切换
 * - 与垂直滚动/下拉刷新自然消歧（水平锁定后 preventDefault 阻止垂直滚动）
 *
 * @example
 * ```svelte
 * <div
 *   use:swipe={{
 *     onSwipeMove: (deltaX) => (offset = deltaX),
 *     onSwipeEnd: (dir) => switchPanel(dir),
 *     onSwipeCancel: () => (offset = 0),
 *   }}
 * >
 *   <!-- 面板内容 -->
 * </div>
 * ```
 */

import { createGestureController, GestureType } from '$lib/modules/gesture';

// ─── 类型定义 ──────────────────────────────────────────────────────

/** swipe action 的配置选项 */
export interface SwipeOptions {
	/**
	 * 方向锁定阈值（px）
	 * 首次移动超过此距离后，根据方向判断是水平滑动还是垂直滚动
	 * @default 10
	 */
	threshold?: number;
	/**
	 * 提交切换的最小距离比例（相对于容器宽度）
	 * 例如 0.3 表示滑动超过容器宽度的 30% 才提交切换
	 * @default 0.3
	 */
	commitThreshold?: number;
	/**
	 * 提交切换的最小速度（px/ms）
	 * 即使距离不够，速度够快也会提交切换（类似轻扫手势）
	 * @default 0.3
	 */
	velocityThreshold?: number;
	/** 滑动开始回调 */
	onSwipeStart?: () => void;
	/** 滑动过程回调，deltaX 为相对于起始位置的水平偏移（px） */
	onSwipeMove?: (deltaX: number) => void;
	/** 滑动结束且应提交切换，direction 为滑动方向 */
	onSwipeEnd?: (direction: 'left' | 'right') => void;
	/** 滑动取消（未达到切换阈值，应回弹到原位） */
	onSwipeCancel?: () => void;
	/**
	 * 是否禁用滑动手势
	 * 传入函数以支持动态检查（如刷新时禁用）
	 * @default () => false
	 */
	disabled?: () => boolean;
}

// ─── Action 实现 ──────────────────────────────────────────────────

/**
 * 水平滑动手势 Svelte Action
 *
 * @param node - 需要检测滑动手势的容器元素
 * @param options - 配置选项
 * @returns Svelte action 返回值
 */
export function swipe(
	node: HTMLElement,
	options: SwipeOptions = {}
): { update: (opts: SwipeOptions) => void; destroy: () => void } {
	let opts = { ...options };
	const threshold = () => opts.threshold ?? 10;
	const commitThreshold = () => opts.commitThreshold ?? 0.3;
	const velocityThreshold = () => opts.velocityThreshold ?? 0.3;

	// ─── 手势状态 ───────────────────────────────────────────────

	/** 手势阶段：idle=空闲, pending=等待方向判定, swiping=水平滑动中, rejected=已判定为垂直 */
	let gesturePhase: 'idle' | 'pending' | 'swiping' | 'rejected' = 'idle';
	/** 触摸起始位置 */
	let startX = 0;
	let startY = 0;
	/** 当前触摸位置 */
	// let lastX = 0;
	/** 触摸起始时间（用于速度计算） */
	let startTime = 0;
	/** 活跃的触摸点 ID（支持多点触控消歧） */
	let activePointerId: number | null = null;

	const { canHandleGesture, lockGesture, unlockGesture } = createGestureController(
		GestureType.SWIPE
	);

	// ─── Touch 事件处理 ─────────────────────────────────────────

	function handleTouchStart(event: TouchEvent): void {
		if (opts.disabled?.() || !canHandleGesture()) return;
		if (activePointerId !== null) return; // 已有活跃触摸点

		const touch = event.touches[0];
		activePointerId = touch.identifier;
		startX = touch.clientX;
		startY = touch.clientY;
		lastX = touch.clientX;
		startTime = Date.now();
		gesturePhase = 'pending';
	}

	function handleTouchMove(event: TouchEvent): void {
		if (gesturePhase === 'idle' || gesturePhase === 'rejected' || !canHandleGesture()) return;

		// 找到活跃触摸点
		const touch = findActiveTouch(event.touches);
		if (!touch) return;

		const deltaX = touch.clientX - startX;
		const deltaY = touch.clientY - startY;

		// 方向判定阶段
		if (gesturePhase === 'pending') {
			const absDeltaX = Math.abs(deltaX);
			const absDeltaY = Math.abs(deltaY);
			const totalDelta = Math.max(absDeltaX, absDeltaY);

			if (totalDelta < threshold()) return; // 移动量不够，继续等待

			if (absDeltaX > absDeltaY) {
				// 水平意图锁定
				gesturePhase = 'swiping';
				opts.onSwipeStart?.();
			} else {
				// 垂直意图，放弃此手势
				gesturePhase = 'rejected';
				return;
			}
		}

		// 水平滑动中
		if (gesturePhase === 'swiping') {
			// 防止其他手势干扰
			lockGesture();

			// 阻止垂直滚动和浏览器 overscroll
			if (event.cancelable) event.preventDefault();
			lastX = touch.clientX;
			opts.onSwipeMove?.(deltaX);
		}
	}

	function handleTouchEnd(event: TouchEvent): void {
		if (!canHandleGesture()) return;
		if (gesturePhase !== 'swiping') {
			resetGesture();
			return;
		}

		// 确认活跃触摸点已释放
		const touch = findChangedTouch(event.changedTouches);
		if (!touch) return;

		const deltaX = touch.clientX - startX;
		const elapsed = Date.now() - startTime;
		const velocity = Math.abs(deltaX) / Math.max(elapsed, 1);
		const containerWidth = node.clientWidth;

		// 判断是否应提交切换
		const distanceCommit = Math.abs(deltaX) > containerWidth * commitThreshold();
		const velocityCommit = velocity > velocityThreshold();

		if (distanceCommit || velocityCommit) {
			const direction = deltaX > 0 ? 'right' : 'left';
			opts.onSwipeEnd?.(direction);
		} else {
			opts.onSwipeCancel?.();
		}

		resetGesture();

		// 解除手势锁
		unlockGesture();
	}

	function handleTouchCancel(): void {
		if (!canHandleGesture()) return;
		if (gesturePhase === 'swiping') {
			opts.onSwipeCancel?.();
		}
		resetGesture();

		// 解除手势锁
		unlockGesture();
	}

	// ─── 辅助函数 ───────────────────────────────────────────────

	/** 在 TouchList 中找到活跃触摸点 */
	function findActiveTouch(touches: TouchList): Touch | null {
		for (let i = 0; i < touches.length; i++) {
			if (touches[i].identifier === activePointerId) return touches[i];
		}
		return null;
	}

	/** 在 changedTouches 中找到活跃触摸点 */
	function findChangedTouch(touches: TouchList): Touch | null {
		for (let i = 0; i < touches.length; i++) {
			if (touches[i].identifier === activePointerId) return touches[i];
		}
		return null;
	}

	/** 重置手势状态 */
	function resetGesture(): void {
		gesturePhase = 'idle';
		activePointerId = null;
		startX = 0;
		startY = 0;
		lastX = 0;
		startTime = 0;
	}

	// ─── 注册事件监听器 ─────────────────────────────────────────

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchmove', handleTouchMove, { passive: false });
	node.addEventListener('touchend', handleTouchEnd);
	node.addEventListener('touchcancel', handleTouchCancel);

	// ─── Action 返回值 ──────────────────────────────────────────

	return {
		update(newOptions: SwipeOptions) {
			opts = { ...newOptions };
		},
		destroy() {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchmove', handleTouchMove);
			node.removeEventListener('touchend', handleTouchEnd);
			node.removeEventListener('touchcancel', handleTouchCancel);
		}
	};
}
