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
 * - **横向 wheel 与历史导航**：在挂载节点上设置 `overscroll-behavior-x: none`，避免 Chrome/Safari（尤其 macOS 触控板）
 *   将横向滚动手势链式到视口后触发「前进/后退」；与 MDN 对 overscroll-behavior 的说明一致
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
import { release, startAnimation, tryAcquire } from '../../../core/arena.svelte';
import { generateId, normalizeWheelDelta } from '../../../core/utils';
import type { PointerPhase, PointerTrack, WheelPhase } from '../types';
import type { SwipeOptions, SwipeState } from './types';
import { createPointerTrack } from './utils';

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

	let lock = false;

	// ── Pointer 通道状态 ──────────────────────────────────────────

	/** 指针状态相关 */
	/** 指针状态机 */
	let pointerPhase: PointerPhase = 'idle';
	/** rAF 节流 ID */
	let pointerRafId: number | null = null;
	/** pointerdown 时的 event.target，用于 arena 边界让渡判断 */
	let pointerTarget: HTMLElement = node;

	/** 主驱动手势相关 */
	/** 参与本笔手势的所有指针：pointerId -> 轨迹（start/current），用于多指接手 */
	const trackedPointers = new Map<number, PointerTrack>();
	/**
	 * 当前驱动位移/速度的指针 ID（「司机」）。
	 * move 阶段若存在 |vx| 显著更大者则换为 leading（带滞后）；换班时位移合并必须用旧 driver 的增量（见 onPointerMove），否则会跳变。
	 */
	let driverId: number | null = null;
	/** 指针离开时累计的位移，与当前主导 pointer 的位移相加得到 totalDelta */
	let accumulatedDeltaX = 0;
	let accumulatedDeltaY = 0;

	/** rAF 期间暂存的最新 deltaX */
	let pendingDeltaX = 0;
	/** rAF 期间暂存的最新 deltaY（副轴） */
	let pendingDeltaY = 0;
	/** rAF 期间暂存的当前 driver 轨迹（用于速度与 onMove） */
	let pendingDriverTrack: PointerTrack | null = null;

	/** 其他相关 */
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

	/**
	 * 多指换班时挑战者横向 |vx| 需比当前 driver 至少大该值（px/ms），否则维持 driver。
	 * 量级参考调试日志中噪声（约 0.01–0.05）与有效差（约 0.15+）。
	 */
	const SWITCH_VELOCITY_MARGIN_PX_PER_MS = 0.08;

	/**
	 * 多指时仅按「瞬时 |vx|」取最大会把 driver 在相邻 pointermove 间来回切：
	 * 当前事件的指针刚 addSample，另一指速度仍是上一帧；双零时 Map 顺序还会与 driverId 不一致（见调试日志）。
	 *
	 * @param currentDriverId - 当前 driver；若挑战者 |vx| 未比当前高出 `SWITCH_VELOCITY_MARGIN_PX_PER_MS`，则维持当前 driver
	 * @returns leadingPointerId 与对应轨迹
	 */
	function getLeading(currentDriverId: number): {
		leadingPointerId: number;
		leadingTrack: PointerTrack;
	} {
		let bestAbsVx = -1;
		let velocityWinnerId: number | null = null;
		let velocityWinnerTrack: PointerTrack | null = null;
		for (const [pid, p] of trackedPointers) {
			const absVx = Math.abs(p.trackerX.getVelocity());
			if (absVx > bestAbsVx) {
				bestAbsVx = absVx;
				velocityWinnerId = pid;
				velocityWinnerTrack = p;
			}
		}
		if (velocityWinnerId === null || velocityWinnerTrack === null) {
			throw new Error('getLeading: trackedPointers 非空却未得到速度比较用的 pointerId/track');
		}

		if (velocityWinnerId === currentDriverId) {
			return { leadingPointerId: velocityWinnerId, leadingTrack: velocityWinnerTrack };
		}

		const currentTrack = trackedPointers.get(currentDriverId);
		if (!currentTrack) {
			return { leadingPointerId: velocityWinnerId, leadingTrack: velocityWinnerTrack };
		}

		const currentAbsVx = Math.abs(currentTrack.trackerX.getVelocity());
		if (bestAbsVx < currentAbsVx + SWITCH_VELOCITY_MARGIN_PX_PER_MS) {
			return {
				leadingPointerId: currentDriverId,
				leadingTrack: currentTrack
			};
		}

		return {
			leadingPointerId: velocityWinnerId,
			leadingTrack: velocityWinnerTrack
		};
	}

	function onPointerDown(e: PointerEvent) {
		if (opts.disabled?.()) return;

		const x = e.clientX;
		const y = e.clientY;
		/**
		 * onStart 仅在本手势会话的「第一根手指」按下时触发。
		 * 额外 pointer（多指）若再次调用 onStart，调用方会误当作新手势并重置 UI（如 SwipeablePane 的 panels/capturedOffset）。
		 */
		if (pointerPhase === 'idle') {
			opts.onStart?.();
			// pointer 状态
			pointerPhase = 'pending';
			pointerTarget = (e.target as HTMLElement) ?? node;

			// 主驱动手势相关
			trackedPointers.set(e.pointerId, createPointerTrack(x, y));
			driverId = e.pointerId;
			return;
		}

		if (trackedPointers.has(e.pointerId)) return;
		trackedPointers.set(e.pointerId, createPointerTrack(x, y));
	}

	function onPointerMove(e: PointerEvent) {
		// ── 指针自动恢复（每个触摸周期最多一次） ─────────────────
		// 场景：方向判定为纵向后 resetPointer 清除了指针，但用户手指仍在屏幕上。
		// 当用户改变滑动方向时，pointermove 从当前位置补救追踪。
		// autoRecoveryUsed 防止 reject → recover → reject 无限循环。
		if (
			trackedPointers.size === 0 &&
			pointerPhase === 'idle' &&
			(e.buttons & 1) !== 0 &&
			!opts.disabled?.() &&
			!autoRecoveryUsed
		) {
			// pointer 状态
			pointerTarget = (e.target as HTMLElement) ?? node;
			pointerPhase = 'pending';

			// 主驱动手势相关
			trackedPointers.set(e.pointerId, createPointerTrack(e.clientX, e.clientY));
			driverId = e.pointerId;

			autoRecoveryUsed = true;
		}

		if (pointerPhase === 'idle' || driverId === null || trackedPointers.size === 0) return;

		// 当前事件的指针
		const track = trackedPointers.get(e.pointerId);
		if (!track) throw new Error('track 不应该为 null，代码出现错误');
		track.currentX = e.clientX;
		track.currentY = e.clientY;
		track.trackerX.addSample(track.currentX);
		track.trackerY.addSample(track.currentY);

		const { leadingPointerId: leadingId, leadingTrack } = getLeading(driverId);

		if (lock) return; // 对多指切换进行锁住，避免重复计算
		/**
		 * 速度换班：|vx| 显著大于当前 driver 者成为 driver（见 `getLeading` 滞后）。
		 * 合并进 accumulated：
		 * - 必须包含「旧 driver」相对其 start 的位移 + 原 accumulated，否则会把上一任已拖出的量丢掉（跳变）。
		 * - 还必须加上「新 leading」在 reset 前相对其 start 的位移：换班帧里本事件已更新新 leading 的 current，
		 *   若随后把 start 设为 current，会抹掉本帧该指位移，表现为新 driver 跟手滞后一拍。
		 */
		if (driverId !== leadingId) {
			lock = true;
			const oldDriver = trackedPointers.get(driverId);
			if (!oldDriver) {
				lock = false;
				return;
			}
			const newLeadingLdx = leadingTrack.currentX - leadingTrack.startX; // 记录本次事件的位移，切换 driver 时也不能丢下本次事件的位移否则会出现跳变
			const newLeadingLdy = leadingTrack.currentY - leadingTrack.startY; // 记录本次事件的位移，切换 driver 时也不能丢下本次事件的位移否则会出现跳变
			const totalDx = accumulatedDeltaX + (oldDriver.currentX - oldDriver.startX) + newLeadingLdx;
			const totalDy = accumulatedDeltaY + (oldDriver.currentY - oldDriver.startY) + newLeadingLdy;
			accumulatedDeltaX = totalDx;
			accumulatedDeltaY = totalDy;
			driverId = leadingId;
			for (const p of trackedPointers.values()) {
				p.startX = p.currentX;
				p.startY = p.currentY;
				p.trackerX.reset();
				p.trackerY.reset();
			}
			lock = false;
		}

		/**
		 * 本事件指针不是 driver 时，跟手位移不会反映到 UI，但 current 已更新；
		 * 若不在此把 start 对齐到 current，非 driver 在「未换班」期间会累积 current-start，
		 * 速度滞后导致换班推迟越久，换班帧并入的 newLeading 越大，出现瞬时跳变。
		 * 速度仍由 tracker 的采样维护，此处只清零「位移基准」。
		 */
		if (driverId !== e.pointerId) {
			track.startX = track.currentX;
			track.startY = track.currentY;
			return;
		}

		// 换班后 driverId === leadingId，leadingTrack 即当前 driver，无需再 get(driverId)
		let dx = accumulatedDeltaX + leadingTrack.currentX - leadingTrack.startX;
		let dy = accumulatedDeltaY + leadingTrack.currentY - leadingTrack.startY;

		// ── 方向判定阶段：位移与 arena 起点均以当前 driver（与 leading 同指）为准 ──
		if (pointerPhase === 'pending') {
			const absDx = Math.abs(dx);
			const absDy = Math.abs(dy);
			if (Math.max(absDx, absDy) < threshold()) return;

			if (absDx <= absDy) {
				resetPointer();
				return;
			}
			console.log('tryAcquire', leadingTrack.startX, leadingTrack.startY);
			const direction = dx > 0 ? 1 : -1;
			const granted = tryAcquire({
				id,
				type: GESTURE_TYPE,
				node,
				axis: 'x',
				direction,
				pointerTarget,
				startX: leadingTrack.startX,
				startY: leadingTrack.startY
			});

			if (!granted) {
				resetPointer();
				return;
			}

			// 将 startX, startY 重置为 currentX, currentY，消除阈值影响
			for (const p of trackedPointers.values()) {
				p.startX = p.currentX;
				p.startY = p.currentY;
			}
			// startX 发生变化，重新计算 dx、dy
			dx = accumulatedDeltaX + leadingTrack.currentX - leadingTrack.startX;
			dy = accumulatedDeltaY + leadingTrack.currentY - leadingTrack.startY;

			pointerPhase = 'active';
			shouldPreventScroll = true;
		}

		// ── 跟手阶段（rAF 节流）：仅 driver 指针的 move 驱动 onMove，避免重复累计 ──
		if (pointerPhase === 'active') {
			pendingDeltaX = dx;
			pendingDeltaY = dy;
			pendingDriverTrack = leadingTrack;

			if (pointerRafId === null) {
				pointerRafId = requestAnimationFrame(() => {
					pointerRafId = null;

					if (pointerPhase !== 'active' || pendingDriverTrack === null) return;

					const velocityX = pendingDriverTrack.trackerX.getVelocity();
					const velocityY = pendingDriverTrack.trackerY.getVelocity();

					opts.onMove?.({
						deltaX: pendingDeltaX,
						deltaY: pendingDeltaY,
						velocityX,
						velocityY,
						direction: (velocityX !== 0 ? velocityX : pendingDeltaX) > 0 ? 'right' : 'left',
						committed: false,
						velocityThresholdUsed: velocityThreshold(), // TODO 良好的设计应该通过 committed 来表明超过阈值，而不是在这里返回阈值
						source: 'pointer'
					});
				});
			}
		}
	}

	function removePointer(pointerIdToRemove: number, isCancel: boolean) {
		// 移除前用当前 driver 算总位移（与 onPointerMove 中 dx 语义一致）
		if (driverId === null) throw new Error('removePointer: driverId 不应为 null');
		const driverTrackBefore = trackedPointers.get(driverId);
		if (!driverTrackBefore) throw new Error('removePointer: driver 轨迹缺失');
		const dx = accumulatedDeltaX + driverTrackBefore.currentX - driverTrackBefore.startX;
		const dy = accumulatedDeltaY + driverTrackBefore.currentY - driverTrackBefore.startY;
		const vx = driverTrackBefore.trackerX.getVelocity();
		const vy = driverTrackBefore.trackerY.getVelocity();

		trackedPointers.delete(pointerIdToRemove);

		// 无剩余指针 → 结束手势
		if (trackedPointers.size === 0) {
			// 取消未执行的 rAF
			if (pointerRafId !== null) {
				cancelAnimationFrame(pointerRafId);
				pointerRafId = null;
			}

			// 计算方向
			const direction = (vx !== 0 ? vx : dx) > 0 ? 'right' : 'left';

			// 计算提交状态
			const distanceCommit = Math.abs(dx) > node.clientWidth * commitThreshold();
			const velocityCommit = Math.abs(vx) > velocityThreshold();
			const committed = velocityCommit || distanceCommit;
			const state: SwipeState = {
				deltaX: pointerPhase === 'active' ? dx : 0,
				deltaY: pointerPhase === 'active' ? dy : 0,
				velocityX: pointerPhase === 'active' ? vx : 0,
				velocityY: pointerPhase === 'active' ? vy : 0,
				direction,
				committed: isCancel ? false : committed,
				velocityThresholdUsed: velocityThreshold(),
				source: 'pointer'
			};

			const result = opts.onEnd?.(state);
			if (result instanceof Promise) {
				registerAnimation(result);
			}

			release(id);
			resetPointer();
			return;
		}

		// 有剩余指针 → 累计到 accumulated，剩余指针的 start 重置为 current，后续由最快手指继续驱动
		accumulatedDeltaX = dx;
		accumulatedDeltaY = dy;
		for (const p of trackedPointers.values()) {
			p.startX = p.currentX;
			p.startY = p.currentY;
			p.trackerX.reset();
			p.trackerY.reset();
		}
		driverId = trackedPointers.keys().next().value as number; // removePointer 前的 leadingPointer 可能已经被清除，所以需要重新选举 driver
	}

	/**
	 * pointerup —— 桌面端（鼠标）手势结束的主信号，触摸端的兜底信号
	 *
	 * 触摸设备上通常已被 touchend 抢先处理，此处 finishPointerGesture
	 * 内部的 pointerPhase 守卫会使其直接跳过。
	 */
	function onPointerUp(e: PointerEvent) {
		if (!trackedPointers.has(e.pointerId)) return;
		removePointer(e.pointerId, false);
	}

	/**
	 * pointercancel —— 系统取消手势（如浏览器接管滚动）
	 *
	 * 语义上是「取消」而非「完成」，因此使用零位移 + committed: false 的状态，
	 * 让调用方回弹到初始位置。
	 */
	function onPointerCancel(e: PointerEvent) {
		if (!trackedPointers.has(e.pointerId)) return;
		removePointer(e.pointerId, true);
	}

	/**
	 * 指针捕获丢失回调
	 *
	 * 通常已被 pointerup / pointercancel 抢先处理
	 * 异常情况下，此事件作为可靠的兜底。
	 */
	function onLostPointerCapture(e: PointerEvent) {
		if (!trackedPointers.has(e.pointerId)) return;
		removePointer(e.pointerId, true);
	}

	/** 重置 Pointer 通道全部状态 */
	function resetPointer() {
		// pointer 状态
		pointerPhase = 'idle';
		// 清除未生效的 rAF
		if (pointerRafId !== null) {
			cancelAnimationFrame(pointerRafId);
			pointerRafId = null;
		}
		pointerTarget = node;

		// 主驱动手势
		trackedPointers.clear();
		driverId = null;
		accumulatedDeltaX = 0;
		accumulatedDeltaY = 0;

		// 位移
		pendingDeltaX = 0;
		pendingDeltaY = 0;
		pendingDriverTrack = null;

		// 其他
		shouldPreventScroll = false;
		autoRecoveryUsed = false;
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
					deltaY: 0,
					velocityX: 0,
					velocityY: 0,
					direction: wheelAccumX > 0 ? 'right' : 'left',
					committed: false,
					velocityThresholdUsed: velocityThreshold(),
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
			deltaY: 0,
			velocityX: 0,
			velocityY: 0,
			direction,
			committed,
			velocityThresholdUsed: velocityThreshold(),
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
		const token = {
			id,
			owner: GESTURE_TYPE,
			interruptible: interruptible(),
			finished: animationPromise
		};
		startAnimation(token);
	}

	// ═══════════════════════════════════════════════════════════════
	// 事件绑定与生命周期
	// ═══════════════════════════════════════════════════════════════

	/** 阻断横向 overscroll 向父级/视口传递，减轻触控板横向 wheel 触发浏览器历史导航 */
	node.style.overscrollBehaviorX = 'none';
	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerCancel);
	node.addEventListener('lostpointercapture', onLostPointerCapture);
	node.addEventListener('wheel', onWheel, { passive: false });
	/** touch-action: none 不足以保证不触发 pointercancel，必须在 touch 层用 preventDefault 兜底 */
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
