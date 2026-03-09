/**
 * @file 水平滑动手势 Svelte Action（Pointer Events + wheel 双通道）
 * @description
 * 检测水平滑动手势，用于 Tab 面板切换、侧滑返回等场景。
 *
 * 核心特性：
 * - **Pointer 通道**：pointerdown → 方向锁定 → arena 竞争 → 跟手 → 提交/取消
 * - **Wheel 通道**：检测横向 deltaX 序列，60ms 防抖判定结束，累计位移触发切换
 * - **方向锁定**：首次移动超过阈值后，|dx| > |dy| 才进入水平滑动
 * - **速度计算**：VelocityTracker 采样，支持"轻扫"快速提交
 * - **竞技场集成**：通过 arena.tryAcquire 与 scrollBoundary 协调边界让渡
 * - **动画保护**：onEnd 返回的 Promise 被包装为 AnimationToken 注册到 arena
 * - **Safari 兼容**：额外 touchmove { passive: false } 阻止滚动
 *
 * @example
 * ```svelte
 * <div use:swipe={{
 *   onMove: (s) => offset.set(s.deltaX, { instant: true }),
 *   onEnd: async (s) => {
 *     if (s.committed) await offset.set(targetX);
 *     else await offset.set(0);
 *   },
 * }}>
 * ```
 */

import type { Action } from 'svelte/action';
import { tryAcquire, release, startAnimation } from './arena.svelte';
import type { SwipeOptions, SwipeState } from './types';
import { createVelocityTracker, generateId, normalizeWheelDelta } from './utils';

// ─── 手势阶段 ────────────────────────────────────────────────────

/** Pointer 通道状态机阶段 */
type PointerPhase = 'idle' | 'pending' | 'active' | 'rejected';

/** Wheel 通道状态机阶段 */
type WheelPhase = 'idle' | 'active';

// ─── Action 实现 ──────────────────────────────────────────────────

/**
 * 水平滑动手势 Svelte Action
 *
 * @param node - 手势容器 DOM 元素
 * @param initialOptions - 配置选项
 * @returns Svelte Action 返回值（update / destroy）
 */
export const swipe: Action<HTMLElement, SwipeOptions> = (node, initialOptions) => {
	const id = generateId('swipe');
	const GESTURE_TYPE = 'swipe';

	/** 当前配置（通过 update 可热更新） */
	let opts: SwipeOptions = { ...initialOptions };

	/** 默认值访问器 */
	const threshold = () => opts.threshold ?? 10;
	const commitThreshold = () => opts.commitThreshold ?? 0.25;
	const velocityThreshold = () => opts.velocityThreshold ?? 0.3;
	const interruptible = () => opts.interruptible ?? true;

	// ── Pointer 通道状态 ──────────────────────────────────────────

	let pointerPhase: PointerPhase = 'idle';
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	/** pointerdown 时的 event.target，用于 arena 边界让渡判断 */
	let pointerTarget: HTMLElement = node;
	const velocityTracker = createVelocityTracker();
	/** rAF 节流 ID */
	let pointerRafId: number | null = null;
	/** rAF 期间暂存的最新 deltaX */
	let pendingDeltaX = 0;
	/** 是否需要阻止 touchmove 默认行为（Safari 兼容） */
	let shouldPreventScroll = false;
	/** 当前触摸周期内是否已使用过一次自动恢复，防止 reject → recover → reject 无限循环 */
	let autoRecoveryUsed = false;

	// ── Wheel 通道状态 ────────────────────────────────────────────

	let wheelPhase: WheelPhase = 'idle';
	/** 累计原始横向位移（px） */
	let wheelAccumX = 0;
	/** 防抖定时器 */
	let wheelDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	/** rAF 帧 ID */
	let wheelRafId: number | null = null;
	/** 待处理的 wheel deltaX */
	let pendingWheelDeltaX = 0;

	// ═══════════════════════════════════════════════════════════════
	// Pointer 通道
	// ═══════════════════════════════════════════════════════════════

	function onPointerDown(e: PointerEvent) {
		autoRecoveryUsed = false;
		if (opts.disabled?.()) return;
		if (pointerId !== null) return;

		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		pointerTarget = (e.target as HTMLElement) ?? node;
		pointerPhase = 'pending';

		velocityTracker.reset();
		velocityTracker.addSample(e.clientX);
	}

	function onPointerMove(e: PointerEvent) {
		// ── 指针自动恢复（每个触摸周期最多一次） ─────────────────
		// 场景：方向判定为纵向后 resetPointer 清除了指针，但用户手指仍在屏幕上。
		// 当用户改变滑动方向时，pointermove 从当前位置补救追踪。
		// autoRecoveryUsed 防止 reject → recover → reject 无限循环。
		if (
			pointerId === null &&
			pointerPhase === 'idle' &&
			(e.buttons & 1) !== 0 &&
			!opts.disabled?.() &&
			!autoRecoveryUsed
		) {
			pointerId = e.pointerId;
			startX = e.clientX;
			startY = e.clientY;
			pointerTarget = (e.target as HTMLElement) ?? node;
			pointerPhase = 'pending';
			velocityTracker.reset();
			velocityTracker.addSample(e.clientX);
			autoRecoveryUsed = true;
		}

		if (e.pointerId !== pointerId) return;
		if (pointerPhase === 'idle' || pointerPhase === 'rejected') return;

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		velocityTracker.addSample(e.clientX);

		// ── 方向判定阶段 ─────────────────────────────────────────
		if (pointerPhase === 'pending') {
			const absDx = Math.abs(dx);
			const absDy = Math.abs(dy);
			if (Math.max(absDx, absDy) < threshold()) return;

			if (absDx <= absDy) {
				resetPointer();
				return;
			}

			// 横向意图 → 向 arena 竞争
			const direction = dx > 0 ? 1 : -1;
			const granted = tryAcquire({
				id,
				type: GESTURE_TYPE,
				node,
				axis: 'x',
				direction,
				pointerTarget
			});

			if (!granted) {
				resetPointer();
				return;
			}

			// 获胜：进入 active，捕获指针
			pointerPhase = 'active';
			shouldPreventScroll = true;
			node.setPointerCapture(e.pointerId);
			opts.onStart?.();
		}

		// ── 跟手阶段（rAF 节流） ────────────────────────────────
		if (pointerPhase === 'active') {
			pendingDeltaX = dx;
			if (pointerRafId === null) {
				pointerRafId = requestAnimationFrame(() => {
					pointerRafId = null;
					if (pointerPhase !== 'active') return;
					opts.onMove?.({
						deltaX: pendingDeltaX,
						velocityX: velocityTracker.getVelocity(),
						direction: pendingDeltaX > 0 ? 'right' : 'left',
						committed: false,
						source: 'pointer'
					});
				});
			}
		}
	}

	function onPointerUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;

		if (pointerPhase === 'active') {
			const dx = e.clientX - startX;
			const vx = velocityTracker.getVelocity();
			const containerWidth = node.clientWidth;

			const distanceCommit = Math.abs(dx) > containerWidth * commitThreshold();
			const velocityCommit = Math.abs(vx) > velocityThreshold();
			const committed = distanceCommit || velocityCommit;
			const direction: 'left' | 'right' = dx > 0 ? 'right' : 'left';

			const state: SwipeState = {
				deltaX: dx,
				velocityX: vx,
				direction,
				committed,
				source: 'pointer'
			};

			// 释放 arena 控制权（手势本身结束，动画由 AnimationGuard 保护）
			release(id);

			// 调用 onEnd，如果返回 Promise 则注册为 AnimationToken
			const result = opts.onEnd?.(state);
			if (result instanceof Promise) {
				registerAnimation(result);
			}
		} else {
			release(id);
		}

		resetPointer();
	}

	function onPointerCancel(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;

		if (pointerPhase === 'active') {
			// 取消 = 未提交，deltaX 回 0
			const state: SwipeState = {
				deltaX: 0,
				velocityX: 0,
				direction: 'right',
				committed: false,
				source: 'pointer'
			};
			release(id);
			const result = opts.onEnd?.(state);
			if (result instanceof Promise) {
				registerAnimation(result);
			}
		} else {
			release(id);
		}

		resetPointer();
	}

	/**
	 * 指针捕获丢失（如系统弹窗抢走焦点）
	 * 等价于 pointercancel 处理
	 */
	/**
	 * 指针捕获丢失回调
	 *
	 * 关键：lostpointercapture 会冒泡。触摸设备上，浏览器在 pointerdown 时
	 * 对触摸目标元素做"隐式捕获"。当我们 setPointerCapture 把捕获转移到父节点时，
	 * 子元素的隐式捕获被释放 → lostpointercapture 在子元素触发并冒泡到这里。
	 * 必须通过 e.target !== node 过滤掉这类冒泡事件，只处理自身节点真正丢失捕获的情况。
	 */
	function onLostPointerCapture(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		// 忽略子元素失去隐式捕获后冒泡上来的事件
		if (e.target !== node) return;

		if (pointerPhase === 'active') {
			const state: SwipeState = {
				deltaX: 0,
				velocityX: 0,
				direction: 'right',
				committed: false,
				source: 'pointer'
			};
			release(id);
			const result = opts.onEnd?.(state);
			if (result instanceof Promise) {
				registerAnimation(result);
			}
		}
		resetPointer();
	}

	/** 重置 Pointer 通道全部状态 */
	function resetPointer() {
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
	 * - active 阶段：始终 preventDefault，阻止浏览器滚动干扰
	 * - pending 阶段（方向未决）：
	 *     · 位移不足阈值 → preventDefault 延缓浏览器接管
	 *     · 位移超过阈值且明确纵向（dy > dx）→ 不阻止，让浏览器处理纵向滚动
	 *     · 位移超过阈值且横向（dx >= dy）→ preventDefault 保护 swipe 手势
	 *
	 * 与旧实现的区别：旧实现 pending 阶段无条件 preventDefault，
	 * 导致每次纵向滚动的前几帧被阻塞，产生可感知的微卡顿。
	 * 新实现在能判定方向时立即放行纵向滚动。
	 */
	function onTouchMove(e: TouchEvent) {
		if (!e.cancelable) return;

		// active 阶段：始终阻止
		if (shouldPreventScroll) {
			e.preventDefault();
			return;
		}

		// pending 阶段：仅在方向未决或横向意图时阻止
		if (pointerPhase === 'pending' && e.touches.length === 1) {
			const dx = Math.abs(e.touches[0].clientX - startX);
			const dy = Math.abs(e.touches[0].clientY - startY);

			// 位移足够判定方向且明确纵向 → 放行，让浏览器处理滚动
			if (Math.max(dx, dy) >= threshold() && dy > dx) {
				return;
			}

			e.preventDefault();
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// Wheel 通道
	// ═══════════════════════════════════════════════════════════════

	function onWheel(e: WheelEvent) {
		if (opts.disabled?.()) return;

		const { deltaX, deltaY } = normalizeWheelDelta(e);

		// 仅处理横向为主的 wheel 事件
		if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

		// 序列开始：尝试获取 arena 控制权
		if (wheelPhase === 'idle') {
			const direction = deltaX > 0 ? -1 : 1;
			const granted = tryAcquire({
				id,
				type: GESTURE_TYPE,
				node,
				axis: 'x',
				direction,
				pointerTarget: (e.target as HTMLElement) ?? node
			});

			if (!granted) return;

			wheelPhase = 'active';
			wheelAccumX = 0;
			opts.onStart?.();
		}

		if (wheelPhase !== 'active') return;

		// 阻止浏览器默认横向滚动
		if (e.cancelable) e.preventDefault();

		// 累计 deltaX
		pendingWheelDeltaX += deltaX;

		// 防抖：60ms 无事件视为序列结束
		if (wheelDebounceTimer !== null) clearTimeout(wheelDebounceTimer);
		wheelDebounceTimer = setTimeout(finishWheelSequence, 60);

		// rAF 更新
		if (wheelRafId === null) {
			wheelRafId = requestAnimationFrame(() => {
				wheelRafId = null;
				if (wheelPhase !== 'active') return;

				// deltaX > 0 表示内容向右滚（等同于手指左滑），取反以匹配 pointer 语义
				wheelAccumX += -pendingWheelDeltaX;
				pendingWheelDeltaX = 0;

				opts.onMove?.({
					deltaX: wheelAccumX,
					velocityX: 0,
					direction: wheelAccumX > 0 ? 'right' : 'left',
					committed: false,
					source: 'wheel'
				});
			});
		}
	}

	/** wheel 序列结束：评估是否达到提交阈值 */
	function finishWheelSequence() {
		wheelDebounceTimer = null;
		if (wheelPhase !== 'active') return;

		const containerWidth = node.clientWidth;
		const committed = Math.abs(wheelAccumX) > containerWidth * commitThreshold();
		const direction: 'left' | 'right' = wheelAccumX > 0 ? 'right' : 'left';

		const state: SwipeState = {
			deltaX: wheelAccumX,
			velocityX: 0,
			direction,
			committed,
			source: 'wheel'
		};

		release(id);

		const result = opts.onEnd?.(state);
		if (result instanceof Promise) {
			registerAnimation(result);
		}

		resetWheel();
	}

	/** 重置 wheel 通道全部状态 */
	function resetWheel() {
		wheelPhase = 'idle';
		wheelAccumX = 0;
		pendingWheelDeltaX = 0;
		if (wheelRafId !== null) {
			cancelAnimationFrame(wheelRafId);
			wheelRafId = null;
		}
		if (wheelDebounceTimer !== null) {
			clearTimeout(wheelDebounceTimer);
			wheelDebounceTimer = null;
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// AnimationToken 注册
	// ═══════════════════════════════════════════════════════════════

	/**
	 * 将 onEnd 返回的 Promise 包装为 AnimationToken 注册到 arena
	 *
	 * @param animationPromise - onEnd 回调返回的 Promise
	 */
	function registerAnimation(animationPromise: Promise<void>) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		let cancelled = false;
		const token = {
			owner: GESTURE_TYPE,
			interruptible: interruptible(),
			cancel: () => {
				cancelled = true;
			},
			finished: animationPromise
		};
		startAnimation(token);
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

	// Safari 滚动阻止补丁
	node.addEventListener('touchmove', onTouchMove, { passive: false });

	return {
		update(newOptions: SwipeOptions) {
			opts = { ...newOptions };
		},
		destroy() {
			// 清理进行中的手势
			if (pointerPhase === 'active' || wheelPhase === 'active') {
				release(id);
			}
			resetPointer();
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
