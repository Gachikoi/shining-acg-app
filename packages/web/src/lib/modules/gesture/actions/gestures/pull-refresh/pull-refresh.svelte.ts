/**
 * @file 下拉刷新 Svelte Action（Pointer Events + wheel 双通道）
 * @description
 * 应用于可滚动容器，在容器滚动到顶部时启用下拉刷新手势。
 *
 * 核心特性：
 * - **Pointer 通道**：pointerdown → 判定 scrollTop≤0 且向下拉 → arena 竞争 → 弹性跟手
 * - **Wheel 通道**：在 scrollTop=0 时检测负 deltaY（trackpad 下拉），防抖判定序列结束
 * - **弹性位移**：iOS Rubber Banding 公式，渐近线保证不会拉过头
 * - **方向锁定**：|dy| > |dx| 才进入下拉模式，横向意图立即退出
 * - **刷新动画**：interruptible: false，刷新期间所有手势被阻塞
 * - **Safari 兼容**：touchmove { passive: false } 阻止浏览器原生橡皮筋效果
 *
 * @example
 * ```svelte
 * <div use:pullRefresh={{ pullDistance, onRefresh: () => store.refresh() }}>
 *   <!-- 可滚动内容 -->
 * </div>
 * ```
 */

import type { Action } from 'svelte/action';
import { release, tryAcquire } from '../../../core/arena.svelte';
import { generateId, normalizeWheelDelta } from '../../../core/utils';
import type { PointerPhase } from '../types';
import type { PullRefreshConfig, PullRefreshOptions } from './types';
import { calculateElasticDistance } from './utils';

// ─── 默认配置 ────────────────────────────────────────────────────

/** 默认下拉刷新配置 */
export const DEFAULT_PULL_REFRESH_CONFIG: PullRefreshConfig = {
	maxDistance: 60,
	triggerThreshold: 40,
	triggeredDistance: 40,
	elasticCoefficient: 0.35,
	elasticDimensionMultiplier: 2.0
};

// ─── 手势阶段 ────────────────────────────────────────────────────

type WheelPhase = 'idle' | 'pulling' | 'scrolling';

// ─── Action 实现 ──────────────────────────────────────────────────

/**
 * 下拉刷新 Svelte Action
 *
 * @param node - 滚动容器 DOM 元素（需有 overflow-y: scroll/auto）
 * @param initialOptions - 配置选项
 * @returns Svelte Action 返回值（update / destroy）
 */
export const pullRefresh: Action<HTMLElement, PullRefreshOptions> = (node, initialOptions) => {
	const id = generateId('pull-refresh');
	const GESTURE_TYPE = 'pull-refresh';

	let opts: PullRefreshOptions = { ...initialOptions };
	const config = () => opts.config ?? DEFAULT_PULL_REFRESH_CONFIG;

	/** 刷新同步锁，防止并发重复触发 */
	let isRefreshLocked = false;

	// ═══════════════════════════════════════════════════════════════
	// Pointer 通道
	// ═══════════════════════════════════════════════════════════════

	let pointerPhase: PointerPhase = 'idle';
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let pointerTarget: HTMLElement = node;
	let pointerRafId: number | null = null;
	let shouldPreventScroll = false;
	/** 当前触摸周期内是否已使用过一次自动恢复，防止 reject → recover → reject 无限循环 */
	let autoRecoveryUsed = false;

	function onPointerDown(e: PointerEvent) {
		autoRecoveryUsed = false;
		if (isRefreshLocked) return;
		if (pointerId !== null) return;
		if (node.scrollTop > 1) return;

		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		pointerTarget = (e.target as HTMLElement) ?? node;
		pointerPhase = 'pending';
	}

	function onPointerMove(e: PointerEvent) {
		// ── 指针自动恢复（每个触摸周期最多一次） ─────────────────
		// 场景：onPointerDown 在 isRefreshLocked 期间被跳过，
		// 或方向判定后被重置，用户手指仍在屏幕上。
		// 当阻塞条件解除后，pointermove 从当前位置补救追踪。
		// autoRecoveryUsed 防止 reject → recover → reject 无限循环。
		if (
			pointerId === null &&
			!isRefreshLocked &&
			pointerPhase === 'idle' &&
			(e.buttons & 1) !== 0 &&
			node.scrollTop <= 1 &&
			!autoRecoveryUsed
		) {
			pointerId = e.pointerId;
			startX = e.clientX;
			startY = e.clientY;
			pointerTarget = (e.target as HTMLElement) ?? node;
			pointerPhase = 'pending';
			autoRecoveryUsed = true;
		}

		if (e.pointerId !== pointerId) return;
		if (pointerPhase === 'idle') return;

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		// ── 方向判定阶段 ─────────────────────────────────────────
		if (pointerPhase === 'pending') {
			// 未达到判定阈值
			if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return;

			if (Math.abs(dx) > Math.abs(dy)) {
				resetPointerState();
				return;
			}

			if (dy <= 0) {
				resetPointerState();
				return;
			}

			if (node.scrollTop > 1) {
				resetPointerState();
				return;
			}

			// 向 arena 竞争
			const granted = tryAcquire({
				id,
				type: GESTURE_TYPE,
				node,
				axis: 'y',
				direction: 1,
				pointerTarget,
				startX,
				startY
			});

			if (!granted) {
				resetPointerState();
				return;
			}

			pointerPhase = 'active';
			shouldPreventScroll = true;
			opts.onPullingChange?.(true);
		}

		// ── 弹性跟手 ────────────────────────────────────────────
		if (pointerPhase === 'active') {
			// 拖动过程中容器发生了滚动（如惯性） → 取消
			if (node.scrollTop > 1) {
				resetPointerAndBounce();
				return;
			}

			const currentDy = e.clientY - startY;
			if (currentDy <= 0) {
				resetPointerAndBounce();
				return;
			}

			// rAF 节流
			if (pointerRafId !== null) return;
			pointerRafId = requestAnimationFrame(() => {
				pointerRafId = null;
				if (pointerPhase !== 'active') return;

				const rawDy = e.clientY - startY;
				if (rawDy <= 0) return;
				const elasticDist = calculateElasticDistance(rawDy, config());
				opts.pullDistance.set(elasticDist, { instant: true });
			});
		}
	}

	function onPointerUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;

		if (pointerPhase === 'active') {
			opts.onPullingChange?.(false);
			finishPullGesture();
		} else {
			release(id);
		}

		resetPointerState();
	}

	function onPointerCancel(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;

		if (pointerPhase === 'active') {
			opts.onPullingChange?.(false);
			opts.pullDistance.target = 0;
			release(id);
		} else {
			release(id);
		}

		resetPointerState();
	}

	/**
	 * 指针捕获丢失回调
	 *
	 * 关键：lostpointercapture 会冒泡。触摸设备上，浏览器在 pointerdown 时
	 * 对触摸目标元素做"隐式捕获"。当我们 setPointerCapture 把捕获转移到本节点时，
	 * 必须通过 e.target !== node 过滤掉这类冒泡事件。
	 */
	function onLostPointerCapture(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;

		if (pointerPhase === 'active') {
			opts.onPullingChange?.(false);
			opts.pullDistance.target = 0;
			release(id);
		}
		resetPointerState();
	}

	/** 评估是否触发刷新并执行回弹 */
	function finishPullGesture() {
		const currentDist = opts.pullDistance.current;
		const cfg = config();

		release(id);

		if (currentDist >= cfg.triggerThreshold) {
			opts.pullDistance.target = cfg.triggeredDistance;
			executeRefresh();
		} else {
			opts.pullDistance.target = 0;
		}
	}

	/**
	 * 执行刷新：await onRefresh → 立即解锁 → 回弹自然播放
	 *
	 * isRefreshLocked 仅在数据请求期间为 true，数据到达后立即解锁。
	 * 回弹动画（Spring → 0）不阻塞任何交互——用户在回弹期间触碰屏幕时，
	 * onPointerMove 的自动恢复逻辑可以立即捡起指针并开始新手势。
	 *
	 * 不注册 arena AnimationToken，不阻塞异轴手势（swipe / scroll 等）。
	 */
	async function executeRefresh(): Promise<void> {
		if (isRefreshLocked) return;
		isRefreshLocked = true;

		try {
			await opts.onRefresh();
		} catch (error) {
			console.error('[pullRefresh] 刷新回调失败:', error);
		}

		// 回弹 + 立即解锁：回弹是纯视觉动画，不应阻塞用户交互
		opts.pullDistance.target = 0;
		isRefreshLocked = false;
	}

	/** 重置 pointer 状态并回弹 pullDistance */
	function resetPointerAndBounce() {
		opts.onPullingChange?.(false);
		shouldPreventScroll = false;
		if (pointerRafId !== null) {
			cancelAnimationFrame(pointerRafId);
			pointerRafId = null;
		}
		opts.pullDistance.target = 0;
		release(id);
		pointerPhase = 'idle';
		pointerId = null;
	}

	/** 仅重置 pointer 跟踪变量（不触发回弹） */
	function resetPointerState() {
		pointerPhase = 'idle';
		pointerId = null;
		startX = 0;
		startY = 0;
		shouldPreventScroll = false;
		if (pointerRafId !== null) {
			cancelAnimationFrame(pointerRafId);
			pointerRafId = null;
		}
	}

	/**
	 * touchmove 滚动阻止（Safari 兼容 + 移动端 pointercancel 防御）
	 *
	 * 移动端浏览器会在前几次 touchmove 中决定是否接管滚动手势。
	 * 一旦接管，所有后续 pointer 事件被 pointercancel 取消，手势识别器来不及判定方向。
	 *
	 * 防御策略：
	 * - active 阶段：始终 preventDefault，阻止浏览器原生橡皮筋效果
	 * - pending 阶段（scrollTop ≤ 1 且触摸向下时）：
	 *     · 位移不足方向判定阈值 → preventDefault 延缓浏览器接管
	 *     · 位移足够且明确横向（dx > dy）→ 放行，让 swipe/浏览器处理
	 *     · 位移足够且纵向下拉 → preventDefault 保护 pullRefresh 手势
	 */
	function onTouchMove(e: TouchEvent) {
		if (!e.cancelable) return;

		// active 阶段：始终阻止
		if (shouldPreventScroll) {
			e.preventDefault();
			return;
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// Wheel 通道
	// ═══════════════════════════════════════════════════════════════

	let wheelPhase: WheelPhase = 'idle';
	/** 累计原始下拉量 */
	let wheelRawDistance = 0;
	let wheelBounceTimer: ReturnType<typeof setTimeout> | null = null;
	let wheelRafId: number | null = null;
	let pendingWheelDeltaY = 0;

	function onWheel(e: WheelEvent) {
		if (isRefreshLocked) return;

		const { deltaY } = normalizeWheelDelta(e);

		// 意图判断：新序列首个事件
		if (wheelPhase === 'idle') {
			if (node.scrollTop <= 1 && deltaY < 0) {
				// 在顶部且向下拉 → 尝试获取控制权
				const granted = tryAcquire({
					id,
					type: GESTURE_TYPE,
					node,
					axis: 'y',
					direction: 1,
					pointerTarget: (e.target as HTMLElement) ?? node
				});

				if (!granted) {
					wheelPhase = 'scrolling';
				} else {
					wheelPhase = 'pulling';
				}
			} else {
				wheelPhase = 'scrolling';
			}
		}

		if (wheelPhase === 'pulling') {
			if (e.cancelable) e.preventDefault();
			pendingWheelDeltaY += deltaY;
		}

		// 防抖：60ms 无事件视为序列结束
		if (wheelBounceTimer !== null) clearTimeout(wheelBounceTimer);
		wheelBounceTimer = setTimeout(() => {
			wheelBounceTimer = null;

			if (wheelPhase === 'pulling') {
				const totalDrag = wheelRawDistance;
				wheelRawDistance = 0;
				pendingWheelDeltaY = 0;

				const PHYSICAL_TRIGGER = 200;
				if (totalDrag >= PHYSICAL_TRIGGER) {
					opts.pullDistance.target = config().triggeredDistance;
					executeRefresh();
				} else {
					opts.pullDistance.target = 0;
				}
				release(id);
			}

			wheelPhase = 'idle';
		}, 60);

		// rAF 更新
		if (wheelRafId === null && wheelPhase === 'pulling') {
			wheelRafId = requestAnimationFrame(() => {
				wheelRafId = null;
				if (wheelPhase !== 'pulling') return;

				const dy = pendingWheelDeltaY;
				pendingWheelDeltaY = 0;

				// deltaY < 0 是下拉，反转并调整灵敏度
				wheelRawDistance += dy * -0.5;
				if (wheelRawDistance < 0) wheelRawDistance = 0;

				const elasticDist = calculateElasticDistance(wheelRawDistance, config());
				opts.pullDistance.set(elasticDist, { instant: true });
			});
		}
	}

	/** 清理 wheel 通道状态 */
	function resetWheel() {
		wheelPhase = 'idle';
		wheelRawDistance = 0;
		pendingWheelDeltaY = 0;
		if (wheelRafId !== null) {
			cancelAnimationFrame(wheelRafId);
			wheelRafId = null;
		}
		if (wheelBounceTimer !== null) {
			clearTimeout(wheelBounceTimer);
			wheelBounceTimer = null;
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// 事件绑定与生命周期
	// ═══════════════════════════════════════════════════════════════

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerCancel);
	node.addEventListener('lostpointercapture', onLostPointerCapture);
	node.addEventListener('wheel', onWheel, { passive: false });
	node.addEventListener('touchmove', onTouchMove, { passive: false });

	return {
		update(newOptions: PullRefreshOptions) {
			opts = { ...newOptions };
		},
		destroy() {
			if (pointerPhase === 'active') release(id);
			resetPointerState();
			resetWheel();

			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerCancel);
			node.removeEventListener('lostpointercapture', onLostPointerCapture);
			node.removeEventListener('wheel', onWheel);
			node.removeEventListener('touchmove', onTouchMove);
		}
	};
};
