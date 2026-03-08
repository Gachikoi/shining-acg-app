/**
 * @file 下拉刷新 Svelte Action
 * @description
 * 从 waterfall-container 提取的可复用下拉刷新手势处理。
 * 同时支持触摸（移动端）和滚轮/触控板（桌面端）两种交互方式。
 *
 * 核心特性：
 * - iOS Rubber Banding 弹性位移公式
 * - pullDistance 驱动的视觉回弹动画
 * - RAF 节流避免掉帧
 * - 滚轮"意图锁定"策略防止惯性误触
 * - 异步刷新回调，action 自动管理锁和回弹
 *
 * @example
 * ```svelte
 * <div
 *   use:pullRefresh={{
 *     pullDistance: pullDistance,
 *     config: pullRefreshConfig,
 *     onRefresh: () => store.refresh(),
 *   }}
 * >
 *   <!-- 可滚动内容 -->
 * </div>
 * ```
 */

import { createGestureController, GestureType } from '$lib/modules/gesture';
import type { Action } from 'svelte/action';
import type { Spring } from 'svelte/motion';

// ─── 类型定义 ──────────────────────────────────────────────────────

/** 下拉刷新配置 */
export interface PullRefreshConfig {
	/** 最大下拉视觉距离（px） */
	maxDistance: number;
	/** 触发刷新的弹性位移阈值（px） */
	triggerThreshold: number;
	/** 触发后 pullDistance 固定到的距离（px），用于显示刷新指示器 */
	triggeredDistance: number;
	/** iOS Rubber Banding 弹性系数 c：越小起步阻力越大（推荐 0.1~0.5） */
	elasticCoefficient: number;
	/** 弹性饱和上限倍数：d = maxDistance × elasticDimensionMultiplier */
	elasticDimensionMultiplier: number;
}

// ─── 默认配置 ──────────────────────────────────────────────────────

/** 默认下拉刷新配置 */
export const DEFAULT_PULL_REFRESH_CONFIG: PullRefreshConfig = {
	maxDistance: 60,
	triggerThreshold: 40,
	triggeredDistance: 40,
	elasticCoefficient: 0.35,
	elasticDimensionMultiplier: 2.0
};

// ─── Action 实现 ──────────────────────────────────────────────────

/**
 * 下拉刷新 Svelte Action
 *
 * 应用于可滚动容器元素（需有 overflow-y: scroll/auto）。
 * 监听 touch 和 wheel 事件，在容器滚动到顶部时启用下拉刷新手势。
 *
 * @param node - 滚动容器 DOM 元素
 * @param options - 配置选项
 * @returns Svelte action 返回值
 */
export const pullRefresh: Action<
	HTMLElement,
	{
		pullDistance: Spring<number>;
		config?: PullRefreshConfig;
		onRefresh: () => Promise<void>;
		onPullingChange?: (isPulling: boolean) => void;
	}
> = (
	node: HTMLElement,
	{ pullDistance, config = DEFAULT_PULL_REFRESH_CONFIG, onRefresh, onPullingChange }
) => {
	// ─── Touch 相关状态 ─────────────────────────────────────────

	/** 是否正处于触摸下拉过程中 */
	let isPulling = false;
	/** 刷新操作同步锁，防止并发重复触发 */
	let isRefreshLocked = false;
	/** 触摸起始 Y 坐标 */
	let startY = 0;
	/** touchmove RAF 帧 ID */
	let touchMoveFrameId: number | null = null;

	// ─── Wheel 相关状态 ─────────────────────────────────────────

	/** 累计原始滚动量（px），wheel 停止后归零 */
	let wheelRawDistance = 0;
	/** 回弹/等待定时器 ID */
	let wheelBounceTimeout: ReturnType<typeof setTimeout> | null = null;
	/** wheel RAF 帧 ID */
	let wheelFrameId: number | null = null;
	/** 待处理的 wheel deltaY */
	let pendingWheelDeltaY = 0;
	/** 滚轮交互状态机：idle=静止, pulling=在顶部下拉, scrolling=正常滚动 */
	let wheelSequenceState: 'idle' | 'pulling' | 'scrolling' = 'idle';

	const { canHandleGesture, lockGesture, unlockGesture } = createGestureController(
		GestureType.PULL_REFRESH
	);

	// ─── 通用辅助函数 ───────────────────────────────────────────

	/**
	 * 弹性位移计算：iOS UIScrollView "Rubber Banding" 公式
	 * y = (1.0 - (1.0 / ((x * c / d) + 1.0))) * d
	 * 渐近线为 d，随 x 增加 y 逼近 d 但不超过
	 *
	 * @param rawDistance - 原始拖动距离（px）
	 * @returns 弹性映射后的视觉位移（px）
	 */
	function calculateElasticDistance(rawDistance: number): number {
		const { maxDistance, elasticCoefficient: c, elasticDimensionMultiplier } = config;
		const d = maxDistance * elasticDimensionMultiplier;
		return (1.0 - 1.0 / ((rawDistance * c) / d + 1.0)) * d;
	}

	/**
	 * 执行刷新：锁定 → 调用 onRefresh → 解锁 → 回弹 pullDistance
	 */
	async function executeRefresh(): Promise<void> {
		if (isRefreshLocked) return;
		isRefreshLocked = true;

		try {
			await onRefresh();
		} catch (error) {
			console.error('[pullRefresh] 刷新回调失败:', error);
		} finally {
			isRefreshLocked = false;
			pullDistance.target = 0;
		}
	}

	/**
	 * 重置触摸下拉状态
	 */
	function resetPullState(): void {
		if (isPulling) {
			isPulling = false;
			onPullingChange?.(false);
		}
		if (touchMoveFrameId !== null) {
			cancelAnimationFrame(touchMoveFrameId);
			touchMoveFrameId = null;
		}
		pullDistance.target = 0;
		// 解除手势锁，确保在取消操作时释放锁
		unlockGesture();
	}

	// ─── Touch 事件处理 ─────────────────────────────────────────

	function handleTouchStart(event: TouchEvent): void {
		if (node.scrollTop > 1 || isPulling || isRefreshLocked || !canHandleGesture()) return;

		startY = event.touches[0].clientY;
		isPulling = true;
		onPullingChange?.(true);
	}

	function handleTouchMove(event: TouchEvent): void {
		if (!isPulling || !canHandleGesture()) return;

		const touchY = event.touches[0].clientY;
		const distance = touchY - startY;

		// 未达到处理阈值
		if (Math.abs(distance) < 5) {
			return;
		}

		// 防止其他手势干扰
		lockGesture();

		// 仅向下拖动时阻止默认滚动（防止浏览器原生橡皮筋效果叠加）
		if (distance > 0 && event.cancelable) {
			event.preventDefault();
		}

		if (touchMoveFrameId !== null) return;

		touchMoveFrameId = requestAnimationFrame(() => {
			touchMoveFrameId = null;
			if (!isPulling) return;

			// 如果在拖动过程中容器发生了滚动，取消下拉
			if (node.scrollTop > 0) {
				resetPullState();
				return;
			}

			const currentDistance = event.touches[0].clientY - startY;
			if (currentDistance <= 0) {
				resetPullState();
				return;
			}

			const elasticDistance = calculateElasticDistance(currentDistance);
			pullDistance.set(elasticDistance, { instant: true });
		});
	}

	function handleTouchEnd(): void {
		if (!isPulling || !canHandleGesture()) return;

		isPulling = false;
		onPullingChange?.(false);

		if (touchMoveFrameId !== null) {
			cancelAnimationFrame(touchMoveFrameId);
			touchMoveFrameId = null;
		}

		const currentDist = pullDistance.current;

		if (currentDist >= config.triggerThreshold) {
			pullDistance.target = config.triggeredDistance;
			executeRefresh();
		} else {
			pullDistance.target = 0;
		}

		unlockGesture();
	}

	function handleTouchCancel(): void {
		if (!canHandleGesture()) return;
		resetPullState();
	}

	// ─── Wheel 事件处理 ─────────────────────────────────────────

	/**
	 * 标准化 wheel 事件的 deltaY
	 * 处理 DOM_DELTA_LINE 和 DOM_DELTA_PAGE 模式
	 */
	function normalizeWheelDelta(event: WheelEvent): number {
		let deltaY = event.deltaY;
		if (event.deltaMode === 1) deltaY *= 40;
		else if (event.deltaMode === 2) deltaY *= 800;
		return deltaY;
	}

	/**
	 * 处理滚轮/触控板事件
	 * 采用"意图锁定"策略：新滚动序列的首个事件决定是下拉还是正常滚动，
	 * 后续事件锁定在同一意图，直到序列结束（60ms 无事件）
	 */
	function handleWheel(event: WheelEvent): void {
		if (isPulling || isRefreshLocked || !canHandleGesture()) return;

		const deltaY = normalizeWheelDelta(event);

		// 意图判断：新序列的首个事件
		if (wheelSequenceState === 'idle') {
			if (node.scrollTop <= 1 && deltaY < 0) {
				wheelSequenceState = 'pulling';
			} else {
				wheelSequenceState = 'scrolling';
			}
			// 防止其他手势干扰
			lockGesture();
		}

		// 仅"下拉"意图时累加 deltaY 并阻止浏览器默认行为
		if (wheelSequenceState === 'pulling') {
			if (event.cancelable) event.preventDefault();
			pendingWheelDeltaY += deltaY;
		} else {
			pendingWheelDeltaY = 0;
		}

		// 防抖定时器：60ms 无事件视为序列结束
		if (wheelBounceTimeout !== null) clearTimeout(wheelBounceTimeout);

		wheelBounceTimeout = setTimeout(() => {
			wheelBounceTimeout = null;

			if (wheelSequenceState === 'pulling') {
				const totalDragDistance = wheelRawDistance;
				wheelRawDistance = 0;
				pendingWheelDeltaY = 0;

				const PHYSICAL_TRIGGER_THRESHOLD = 200;
				if (totalDragDistance >= PHYSICAL_TRIGGER_THRESHOLD) {
					pullDistance.target = config.triggeredDistance;
					executeRefresh();
				} else {
					pullDistance.target = 0;
				}
			}

			wheelSequenceState = 'idle';
			// 解除手势锁
			unlockGesture();
		}, 60);

		// RAF 更新 UI
		if (wheelFrameId === null && wheelSequenceState === 'pulling') {
			wheelFrameId = requestAnimationFrame(() => {
				wheelFrameId = null;
				if (wheelSequenceState !== 'pulling') return;

				const dy = pendingWheelDeltaY;
				pendingWheelDeltaY = 0;

				// deltaY < 0 是下拉，反转符号并调整灵敏度
				wheelRawDistance += dy * -0.5;
				if (wheelRawDistance < 0) wheelRawDistance = 0;

				const targetDistance = calculateElasticDistance(wheelRawDistance);
				pullDistance.set(targetDistance, { instant: true });
			});
		}
	}

	// ─── 清理 ───────────────────────────────────────────────────

	function cleanup(): void {
		if (touchMoveFrameId !== null) {
			cancelAnimationFrame(touchMoveFrameId);
			touchMoveFrameId = null;
		}
		if (wheelFrameId !== null) {
			cancelAnimationFrame(wheelFrameId);
			wheelFrameId = null;
		}
		if (wheelBounceTimeout !== null) {
			clearTimeout(wheelBounceTimeout);
			wheelBounceTimeout = null;
		}
	}

	$effect(() => {
		node.addEventListener('touchstart', handleTouchStart, { passive: true });
		node.addEventListener('touchmove', handleTouchMove, { passive: false });
		node.addEventListener('touchend', handleTouchEnd);
		node.addEventListener('touchcancel', handleTouchCancel);
		node.addEventListener('wheel', handleWheel, { passive: false });

		return () => {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchmove', handleTouchMove);
			node.removeEventListener('touchend', handleTouchEnd);
			node.removeEventListener('touchcancel', handleTouchCancel);
			node.removeEventListener('wheel', handleWheel);
			cleanup();
		};
	});
};
