/**
 * @file Feed 流纵向手势（下拉 + 滚动 RAF + 触底）
 * @description
 * 必须挂载在可以纵向滚动的节点上，如 overflow-y-scroll 的容器。
 */

import type { Action } from 'svelte/action';
import { release, tryAcquire } from '../../../core/arena.svelte';
import { generateId, normalizeWheelDelta } from '../../../core/utils';
import type { PointerPhase } from '../types';
import type { FeedStreamGestureOptions, WheelPullPhase } from './types';
import {
	isLoadMoreEnabled,
	isPullEnabled,
	mapElasticDistance,
	needsScrollListener,
	resolveFeedStreamConfig
} from './utils';

/**
 * Feed 流纵向手势
 *
 * @param node - 滚动容器
 * @param initialOptions - 配置
 * @returns Action 生命周期
 */
export const feedStream: Action<HTMLElement, FeedStreamGestureOptions> = (node, initialOptions) => {
	const id = generateId('feed-stream');
	const GESTURE_TYPE = 'feed-stream';

	let opts: FeedStreamGestureOptions = { ...initialOptions };

	let scrollFrameId: number | null = null;
	let scrollAttached = false;

	let pullAttached = false;

	/**
	 * 滚动容器可视高度（px）：`ResizeObserver` 存在时随节点尺寸更新，避免每次 `scroll` 合并帧都读 `clientHeight`。
	 * 无 `ResizeObserver` 时在合并帧内回退为直接读 `node.clientHeight`。
	 */
	let cachedViewportHeightPx = 0;
	let viewportResizeObserver: ResizeObserver | null = null;

	/**
	 * 将 `node.clientHeight` 写入 `cachedViewportHeightPx`。
	 */
	function refreshViewportHeightCache(): void {
		cachedViewportHeightPx = node.clientHeight;
	}

	// ── Scroll ────────────────────────────────────────────────────

	function onScroll(): void {
		if (scrollFrameId !== null) return;
		scrollFrameId = requestAnimationFrame(async () => {
			scrollFrameId = null;
			const scrollTop = node.scrollTop;
			opts.onScrollFrame?.({ scrollTop });

			if (!isLoadMoreEnabled(opts) || !opts.onLoadMore) return;

			const loadingThreshold = resolveFeedStreamConfig(opts.config).loadingThreshold;
			const viewportH =
				viewportResizeObserver !== null ? cachedViewportHeightPx : node.clientHeight;
			const contentH = opts.getContentHeight?.() ?? node.scrollHeight;
			if (contentH <= 0) return;

			const hasMore = opts.hasMore?.() ?? true;
			const loading = opts.loading?.() ?? false;

			if (contentH - scrollTop - viewportH < loadingThreshold && hasMore && !loading) {
				await opts.onLoadMore();
			}
		});
	}

	function syncScrollAttachment(): void {
		const need = needsScrollListener(opts);
		if (need === scrollAttached) return;
		if (need) {
			node.addEventListener('scroll', onScroll, { passive: true });
			scrollAttached = true;
		} else {
			node.removeEventListener('scroll', onScroll);
			scrollAttached = false;
		}
	}

	// ── Pull：Pointer ─────────────────────────────────────────────

	let pointerPhase: PointerPhase = 'idle';
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let pointerTarget: HTMLElement = node;
	let pointerRafId: number | null = null;
	let shouldPreventScroll = false;
	let autoRecoveryUsed = false;
	/** 最近一次跟手的弹性位移，供 `onPullEnd` */
	let lastPointerElasticPx = 0;

	function onPointerDown(e: PointerEvent): void {
		if (!isPullEnabled(opts)) return;
		if (opts.disabled?.('pointer')) return;
		autoRecoveryUsed = false;
		if (pointerId !== null) return;
		if (node.scrollTop > 1) return;

		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		pointerTarget = (e.target as HTMLElement) ?? node;
		pointerPhase = 'pending';
	}

	function onPointerMove(e: PointerEvent): void {
		if (!isPullEnabled(opts)) return;

		if (
			pointerId === null &&
			pointerPhase === 'idle' &&
			(e.buttons & 1) !== 0 &&
			node.scrollTop <= 1 &&
			!autoRecoveryUsed &&
			!opts.disabled?.('pointer')
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

		if (pointerPhase === 'pending') {
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
			opts.onPullActiveChange?.(true);
		}

		if (pointerPhase === 'active') {
			if (node.scrollTop > 1) {
				resetPointerAndBounce('pointer');
				return;
			}

			const currentDy = e.clientY - startY;
			if (currentDy <= 0) {
				resetPointerAndBounce('pointer');
				return;
			}

			if (pointerRafId !== null) return;
			pointerRafId = requestAnimationFrame(() => {
				pointerRafId = null;
				if (pointerPhase !== 'active') return;

				const rawDy = e.clientY - startY;
				if (rawDy <= 0) return;
				const cfg = resolveFeedStreamConfig(opts.config);
				const elasticPx = mapElasticDistance(rawDy, cfg);
				lastPointerElasticPx = elasticPx;
				opts.onPullMove?.({ elasticPx, rawDy, source: 'pointer' });
			});
		}
	}

	function onPointerUp(e: PointerEvent): void {
		if (!isPullEnabled(opts)) return;
		if (e.pointerId !== pointerId) return;

		if (pointerPhase === 'active') {
			const cfg = resolveFeedStreamConfig(opts.config);
			const committed = lastPointerElasticPx >= cfg.triggerThreshold;
			release(id);
			opts.onPullEnd?.({
				committed,
				elasticPx: lastPointerElasticPx,
				source: 'pointer'
			});
			opts.onPullActiveChange?.(false);
		} else {
			release(id);
		}

		resetPointerState();
	}

	function onPointerCancel(e: PointerEvent): void {
		if (!isPullEnabled(opts)) return;
		if (e.pointerId !== pointerId) return;

		if (pointerPhase === 'active') {
			release(id);
			opts.onPullEnd?.({ committed: false, elasticPx: 0, source: 'pointer' });
			opts.onPullActiveChange?.(false);
		} else {
			release(id);
		}

		resetPointerState();
	}

	function onLostPointerCapture(e: PointerEvent): void {
		if (!isPullEnabled(opts)) return;
		if (e.pointerId !== pointerId) return;

		if (pointerPhase === 'active') {
			release(id);
			opts.onPullEnd?.({ committed: false, elasticPx: 0, source: 'pointer' });
			opts.onPullActiveChange?.(false);
		}
		resetPointerState();
	}

	function resetPointerAndBounce(source: 'pointer'): void {
		opts.onPullActiveChange?.(false);
		shouldPreventScroll = false;
		if (pointerRafId !== null) {
			cancelAnimationFrame(pointerRafId);
			pointerRafId = null;
		}
		release(id);
		opts.onPullEnd?.({ committed: false, elasticPx: 0, source });
		pointerPhase = 'idle';
		pointerId = null;
	}

	function resetPointerState(): void {
		pointerPhase = 'idle';
		pointerId = null;
		startX = 0;
		startY = 0;
		shouldPreventScroll = false;
		lastPointerElasticPx = 0;
		if (pointerRafId !== null) {
			cancelAnimationFrame(pointerRafId);
			pointerRafId = null;
		}
	}

	function onTouchMove(e: TouchEvent): void {
		if (!isPullEnabled(opts)) return;
		if (!e.cancelable) return;
		if (shouldPreventScroll) {
			e.preventDefault();
		}
	}

	// ── Pull：Wheel ────────────────────────────────────────────────

	let wheelPullPhase: WheelPullPhase = 'idle';
	let wheelRawDistance = 0;
	let wheelDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	let pullWheelRafId: number | null = null;
	let pendingWheelDeltaY = 0;

	function onWheelPull(e: WheelEvent): void {
		if (!isPullEnabled(opts)) return;
		if (opts.disabled?.('wheel')) return;

		const { deltaY } = normalizeWheelDelta(e);

		if (wheelPullPhase === 'idle') {
			if (node.scrollTop <= 1 && deltaY < 0) {
				const granted = tryAcquire({
					id,
					type: GESTURE_TYPE,
					node,
					axis: 'y',
					direction: 1,
					pointerTarget: (e.target as HTMLElement) ?? node
				});

				if (!granted) {
					wheelPullPhase = 'scrolling';
				} else {
					wheelPullPhase = 'pulling';
					opts.onPullActiveChange?.(true);
				}
			} else {
				wheelPullPhase = 'scrolling';
			}
		}

		if (wheelPullPhase === 'pulling') {
			if (e.cancelable) e.preventDefault();
			pendingWheelDeltaY += deltaY;
		}

		if (wheelDebounceTimer !== null) clearTimeout(wheelDebounceTimer);
		wheelDebounceTimer = setTimeout(finishWheelPullSequence, 60);

		if (pullWheelRafId === null && wheelPullPhase === 'pulling') {
			pullWheelRafId = requestAnimationFrame(() => {
				pullWheelRafId = null;
				if (wheelPullPhase !== 'pulling') return;

				const dy = pendingWheelDeltaY;
				pendingWheelDeltaY = 0;

				wheelRawDistance += dy * -0.5;
				if (wheelRawDistance < 0) wheelRawDistance = 0;

				const cfg = resolveFeedStreamConfig(opts.config);
				const elasticPx = mapElasticDistance(wheelRawDistance, cfg);
				opts.onPullMove?.({ elasticPx, rawDy: wheelRawDistance, source: 'wheel' });
			});
		}
	}

	function finishWheelPullSequence(): void {
		wheelDebounceTimer = null;
		if (wheelPullPhase !== 'pulling') {
			wheelPullPhase = 'idle';
			return;
		}

		const totalDrag = wheelRawDistance;
		const cfg = resolveFeedStreamConfig(opts.config);
		const elasticPx = mapElasticDistance(totalDrag, cfg);
		const committed = totalDrag >= cfg.wheelPullPhysicalCommit;

		wheelRawDistance = 0;
		pendingWheelDeltaY = 0;
		release(id);
		opts.onPullEnd?.({ committed, elasticPx, source: 'wheel' });
		opts.onPullActiveChange?.(false);

		wheelPullPhase = 'idle';
	}

	function resetWheelPull(): void {
		wheelPullPhase = 'idle';
		wheelRawDistance = 0;
		pendingWheelDeltaY = 0;
		if (pullWheelRafId !== null) {
			cancelAnimationFrame(pullWheelRafId);
			pullWheelRafId = null;
		}
		if (wheelDebounceTimer !== null) {
			clearTimeout(wheelDebounceTimer);
			wheelDebounceTimer = null;
		}
	}

	function attachPull(): void {
		if (pullAttached) return;
		node.addEventListener('pointerdown', onPointerDown);
		node.addEventListener('pointermove', onPointerMove);
		node.addEventListener('pointerup', onPointerUp);
		node.addEventListener('pointercancel', onPointerCancel);
		node.addEventListener('lostpointercapture', onLostPointerCapture);
		node.addEventListener('wheel', onWheelPull, { passive: false });
		node.addEventListener('touchmove', onTouchMove, { passive: false });
		pullAttached = true;
	}

	function detachPull(): void {
		if (!pullAttached) return;
		node.removeEventListener('pointerdown', onPointerDown);
		node.removeEventListener('pointermove', onPointerMove);
		node.removeEventListener('pointerup', onPointerUp);
		node.removeEventListener('pointercancel', onPointerCancel);
		node.removeEventListener('lostpointercapture', onLostPointerCapture);
		node.removeEventListener('wheel', onWheelPull);
		node.removeEventListener('touchmove', onTouchMove);
		pullAttached = false;
	}

	function syncPullAttachment(): void {
		if (isPullEnabled(opts)) {
			attachPull();
		} else {
			if (pointerPhase === 'active') release(id);
			resetPointerState();
			resetWheelPull();
			detachPull();
		}
	}

	refreshViewportHeightCache();
	if (typeof ResizeObserver !== 'undefined') {
		viewportResizeObserver = new ResizeObserver(refreshViewportHeightCache);
		viewportResizeObserver.observe(node);
	}

	syncScrollAttachment();
	syncPullAttachment();

	return {
		update(newOptions: FeedStreamGestureOptions): void {
			opts = { ...newOptions };
			syncScrollAttachment();
			syncPullAttachment();
		},
		destroy(): void {
			if (pointerPhase === 'active') release(id);
			resetPointerState();
			resetWheelPull();

			if (viewportResizeObserver !== null) {
				viewportResizeObserver.disconnect();
				viewportResizeObserver = null;
			}

			if (scrollFrameId !== null) {
				cancelAnimationFrame(scrollFrameId);
				scrollFrameId = null;
			}
			if (scrollAttached) {
				node.removeEventListener('scroll', onScroll);
				scrollAttached = false;
			}

			detachPull();
		}
	};
};
