<!--
  @component FeedContainer
  Feed 流通用滚动容器，统一封装：
  - 滚动容器 + `use:feedStream`（下拉手势 + scroll RAF + 触底加载）
  - 弹性下拉动画层（translateY）：完全由直接 DOM 操作驱动，绕过 Svelte 批更新
  - FeedPullHeader / FeedStreamFooter（内部实现，不对外暴露）
  - ResizeObserver：通过 `onViewportResize` 通知外部视口宽高变化

  外部通过 `bind:this` 获取组件实例后可调用：
  - `scrollTo(options)` — 透明转发 scrollContainer.scrollTo
  - `scrollToTopAndRefresh()` — 完整动画：平滑滚顶 → rAF 等待 → pull 动画 → onRefresh → 回弹

  ─── 动画实现原理 ───────────────────────────────────────────────
  CSS transition 触发需满足：
    1. 浏览器已"见过"当前 transform 值（存在旧值快照）
    2. 在下一帧 将 transform 改变为新值（有明确 from → to）
  如果在同一个 Svelte 批更新中同时写入 transition + transform，浏览器会将它们视为
  同一帧的初始状态，transition 不会触发。
  解决方案：不使用 Svelte style="..." 属性插值（setAttribute 会覆盖 el.style.*），
  改为全程直接 DOM 操作：
  - 跟手（followShift）：立即设置 transform，transition='none'
  - 松手回弹（animateShift）：当帧写 transition='...'，下一 rAF 写 transform
  这保证浏览器在两帧之间有旧值快照，transition 正常触发。
-->
<script lang="ts">
	import {
		feedStream,
		resolveFeedStreamConfig,
		type FeedPullEndPayload,
		type FeedPullMovePayload,
		type FeedScrollFramePayload,
		type FeedStreamConfig,
		type FeedStreamFeatures,
		type FeedStreamGestureOptions
	} from '$lib/modules/gesture';
	import { cn } from '$lib/utils';
	import {
		CSS_TRANSITION_DURATION_MS,
		CSS_TRANSITION_EASING,
		waitForElementTransitions
	} from '$lib/utils/animation';
	import type { Snippet } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
	import FeedPullHeader from './feed-pull-header.svelte';
	import FeedStreamFooter from './feed-stream-footer.svelte';

	let {
		itemCount = 0,
		loading = false,
		hasMore = true,
		showSkeleton = false,
		refreshing = false,
		onLoadMore,
		onRefresh,
		onScrollFrame,
		getContentHeight,
		onViewportResize,
		elasticConfig = {},
		features = { pull: true, loadMore: true },
		scrollContainerClass,
		children
	}: {
		/** 数据条目总数（供 FeedStreamFooter 判断是否展示「没有更多」）*/
		itemCount?: number;
		/** 是否正在加载更多 */
		loading?: boolean;
		/** 是否还有更多数据 */
		hasMore?: boolean;
		/** 是否显示骨架屏（与 loading 一同用于 feedStream 触底守卫） */
		showSkeleton?: boolean;
		/** 是否正在下拉刷新（由外部控制，用于 FeedPullHeader 展示） */
		refreshing?: boolean;
		/** 触底加载回调 */
		onLoadMore?: () => void | Promise<void>;
		/**
		 * 下拉刷新回调。
		 * 外部应在此函数中完成数据刷新（以及必要的布局清理）。
		 * FeedContainer 负责调用时机与动画，不关心刷新内容。
		 */
		onRefresh?: () => Promise<void>;
		/** scroll RAF 回调，透传给 feedStream（虚拟滚动 scrollTop 同步） */
		onScrollFrame?: (payload: FeedScrollFramePayload) => void;
		/**
		 * 内容高度 getter，透传给 feedStream 用于触底计算。
		 * 虚拟列表必传（否则 feedStream 退回 node.scrollHeight 估算）。
		 */
		getContentHeight?: () => number;
		/**
		 * 视口尺寸变化回调，由内部 ResizeObserver 驱动。
		 * 替代对外暴露 scrollContainerEl：waterfall 等子组件通过此回调获得视口宽高，
		 * 并在首次触发时尝试恢复布局快照，无需持有 DOM 元素引用。
		 *
		 * @param width - 滚动容器内容宽度（content-box px，不含 padding）
		 * @param height - 滚动容器可见高度（content-box px）
		 */
		onViewportResize?: (width: number, height: number) => void;
		/** Feed 流手势配置；未填字段使用包内默认（见 `resolveFeedStreamConfig`） */
		elasticConfig?: Partial<FeedStreamConfig>;
		/** 下拉 / 触底能力开关 */
		features?: FeedStreamFeatures;
		/**
		 * 滚动容器额外 class。
		 * 常见用途：将 padding 放在此处，使 ResizeObserver content-box 宽度自动减去 padding，
		 * 子组件（如 waterfall）可直接用 containerWidth 计算布局无需再减 padding。
		 * 例：`scrollContainerClass="px-4"` → containerWidth = 容器宽度 - 32px
		 */
		scrollContainerClass?: string;
		/** 默认 snippet：实际 feed 流内容 */
		children: Snippet;
	} = $props();

	/** 合并默认后的完整配置，供 Header 与下拉动画读取 */
	let resolvedElastic = $derived(resolveFeedStreamConfig(elasticConfig));

	// ─── DOM 引用 ────────────────────────────────────────────────

	/** 滚动容器（feedStream + ResizeObserver 挂载点） */
	let scrollContainer: HTMLElement;

	/**
	 * 内容位移层（translateY pull 动画目标）。
	 * 声明为普通变量而非 $state——动画完全通过直接 DOM 操作驱动，
	 * 不经 Svelte 响应式系统，避免 setAttribute('style') 覆盖 el.style.transition。
	 */
	let contentShiftEl: HTMLElement | undefined;

	// ─── Pull 动画状态 ───────────────────────────────────────────

	/**
	 * Header 显示量（仅供 FeedPullHeader 读取，不驱动动画本身）。
	 * 跟手时与动画同步更新，回弹完成后清零。
	 * 允许比动画慢一帧（$state 经 Svelte 批更新），不影响视觉质量。
	 */
	let pullDisplayPx = $state(0);

	/**
	 * 接续基准：进入下拉会话时从 DOM 读到的弹性位移（px）。
	 * 新手势的 `p.elasticPx` 从 0 起算，跟手总位移 = 本值 + `p.elasticPx`；`onPullEnd` 入 `handlePullEnd` 前会清零。
	 */
	let pullCarryoverElasticPx = 0;

	// pull end 执行动画序列，且触发 pull end 动画序列为 wheel 事件时，由于 wheel 有惯性会在中途触发 onPullMove，导致 transform 突变，transition 失效，所以要
	let isPullEndExecuting = $state(false);

	/**
	 * FeedPullHeader 高度 + 外包层 mb-3 合计占位量（px）。
	 * FeedPullHeader `h-4`（16px）+ 外包层 `mb-3`（12px）= 28px。
	 * pull 启用时内容层向上偏移此量，保证 scrollTop=0 时卡片顶部对齐视口顶部。
	 */
	const PULL_LAYOUT_OFFSET_PX = 28;

	// ─── ResizeObserver ──────────────────────────────────────────

	let viewportObserver: ResizeObserver;

	// ─── Pull 动画核心（全程直接 DOM 操作） ─────────────────────

	/**
	 * 计算 contentShiftEl 的目标 translateY 值。
	 * pull 启用时减去 PULL_LAYOUT_OFFSET_PX，使 header 隐藏在视口上方。
	 *
	 * @param elasticPx - 当前弹性位移（px）
	 * @returns CSS translateY 字符串，如 `translateY(-28px)`
	 */
	function computeTranslateY(elasticPx: number): string {
		const offset = pullEnabled ? elasticPx - PULL_LAYOUT_OFFSET_PX : elasticPx;
		return `translateY(${offset}px)`;
	}

	/**
	 * 从内容层当前 computed transform 反推弹性位移（px），与 `computeTranslateY` 互逆（线性，非 mapElastic 逆映射）。
	 *
	 * @returns 与 `followShift` / `pullDisplayPx` 同量纲的 elasticPx
	 */
	function readElasticPxFromContentShift(): number {
		if (!contentShiftEl) return 0;
		const t = getComputedStyle(contentShiftEl).transform;
		if (t === 'none') return 0;
		const m = new DOMMatrix(t);
		const ty = m.m42;
		return pullEnabled ? ty + PULL_LAYOUT_OFFSET_PX : ty;
	}

	/**
	 * 跟手模式：立即将 transform 设为目标值，无过渡动画。
	 * 在 onPullMove 回调中调用，每指针/wheel 帧执行一次，需保证无 jank。
	 *
	 * @param elasticPx - 目标弹性位移（px）
	 */
	function followShift(elasticPx: number): void {
		if (!contentShiftEl) return;
		contentShiftEl.style.transform = computeTranslateY(elasticPx);
	}

	/**
	 * 动画模式：启用 CSS transition 后在下一 rAF 中改变 transform，确保动画触发。
	 *
	 * CSS transition 触发要求浏览器在应用新 transform 之前已"看到"旧值。
	 * 若在同一帧同时写 transition + transform，浏览器视为初始状态，transition 不触发。
	 * 解决方案：当帧写 transition，下一 rAF 写 transform（浏览器已提交旧快照）。
	 *
	 * @param elasticPx - 目标弹性位移（px）
	 * @returns 过渡动画结束后 resolve 的 Promise
	 */
	function animateShift(elasticPx: number): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!contentShiftEl) {
				reject(new Error('未找到 contentShiftEl'));
				return;
			}
			// 当帧：写入 transition（浏览器记录当前 transform 为起点）
			contentShiftEl.style.transition = `transform ${CSS_TRANSITION_DURATION_MS}ms ${CSS_TRANSITION_EASING}`;
			contentShiftEl.style.transform = computeTranslateY(elasticPx);
			waitForElementTransitions(contentShiftEl).then(() => {
				resolve();
			});
		});
	}

	/**
	 * 进入下拉会话时：取消内容层上的 transform 过渡 / Web Animation，从 DOM 读取当前弹性位移作为接续基准，并允许新的 `onPullEnd`（打断 `handlePullEnd` 中的 await）。
	 */
	function captureCarryoverAndCancelTransition(): void {
		if (!contentShiftEl) return;
		contentShiftEl.style.transition = 'none';
		for (const a of contentShiftEl.getAnimations({ subtree: false })) {
			a.cancel();
		}
		pullCarryoverElasticPx = readElasticPxFromContentShift();
		pullDisplayPx = pullCarryoverElasticPx;
		isPullEndExecuting = false;
	}

	/**
	 * 下拉手势结束处理：
	 * - 未提交 → animateShift(0) 回弹
	 * - 已提交 → followShift(triggeredDistance) 锁定 → await onRefresh → animateShift(0) 回弹
	 *
	 * @param committed - 是否超过触发阈值（来自 feedStream onPullEnd 回调）
	 */
	async function handlePullEnd(committed: boolean): Promise<void> {
		if (isPullEndExecuting) return;
		isPullEndExecuting = true;
		if (!committed) {
			await animateShift(0);
			pullDisplayPx = 0;
			isPullEndExecuting = false;
			return;
		}

		// 已提交：锁定在触发距离（用户松手时已接近此值，followShift 跳过动画）
		pullDisplayPx = resolvedElastic.triggeredDistance;
		await Promise.all([animateShift(resolvedElastic.triggeredDistance), onRefresh?.()]);
		pullDisplayPx = 0;
		// 刷新完成后回弹
		pullDisplayPx = 0;
		await animateShift(0);
		isPullEndExecuting = false;
	}

	// ─── feedStream 配置 ─────────────────────────────────────────

	const pullEnabled = $derived(features?.pull !== false && !!onRefresh);
	const loadMoreEnabled = $derived(features?.loadMore !== false);

	let feedStreamOptions = $derived.by(
		(): FeedStreamGestureOptions => ({
			config: resolvedElastic,
			features: {
				pull: pullEnabled,
				loadMore: loadMoreEnabled
			},
			disabled: (source) => source === 'wheel' && isPullEndExecuting,
			onPullActiveChange: pullEnabled
				? (active: boolean) => {
						if (active) {
							captureCarryoverAndCancelTransition();
						}
					}
				: undefined,
			onPullMove: pullEnabled
				? (p: FeedPullMovePayload) => {
						const totalElasticPx = pullCarryoverElasticPx + p.elasticPx;
						// 跟手路径：直接操作 DOM，不经 Svelte 批更新，保证 60fps 无 jank
						followShift(totalElasticPx);
						// pullDisplayPx 允许滞后一帧（$state → Svelte 批更新），不影响动画流畅度
						pullDisplayPx = totalElasticPx;
					}
				: undefined,
			onPullEnd: pullEnabled
				? (p: FeedPullEndPayload) => {
						const totalElasticPx = pullCarryoverElasticPx + p.elasticPx;
						const committed =
							p.source === 'pointer'
								? totalElasticPx >= resolvedElastic.triggerThreshold
								: p.committed;
						pullCarryoverElasticPx = 0;
						handlePullEnd(committed);
					}
				: undefined,
			onScrollFrame,
			// 不能直接用 contentShiftEl.scrollHeight 的原因是，scrollHeight 包含了 Header 和 Footer，不能精确反映内容高度
			getContentHeight: getContentHeight ?? (() => contentShiftEl?.scrollHeight ?? 0),
			hasMore: () => hasMore,
			loading: () => loading || showSkeleton,
			onLoadMore: loadMoreEnabled ? onLoadMore : undefined
		})
	);

	// ─── 暴露给外部的方法（供 bind:this 后调用） ────────────────

	/**
	 * 透明转发 scrollContainer.scrollTo，供外部无需持有 DOM 引用时控制滚动位置。
	 *
	 * @param options - ScrollToOptions（同原生 API）
	 */
	export function scrollTo(options: ScrollToOptions): void {
		scrollContainer?.scrollTo(options);
	}

	/**
	 * 平滑滚顶 + 完整 pull 动画 + onRefresh 调用。
	 * 供外部程序化触发刷新（Tab 二次点击、顶部刷新按钮等）。
	 *
	 * 流程：smooth scrollTo(0) → rAF 轮询 scrollTop ≤ 0 → followShift(triggeredDistance)
	 *       → await onRefresh → animateShift(0)
	 */
	export function scrollToTopAndRefresh(): void {
		if (!scrollContainer) {
			onRefresh?.();
			return;
		}

		scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });

		const waitForTop = () => {
			if (!scrollContainer) return;
			if (scrollContainer.scrollTop <= 0) {
				(async () => {
					pullDisplayPx = resolvedElastic.triggeredDistance;
					await Promise.all([animateShift(resolvedElastic.triggeredDistance), onRefresh?.()]);
					if (pullCarryoverElasticPx > 0) return;
					pullDisplayPx = 0;
					await animateShift(0);
					if (pullCarryoverElasticPx > 0) return;
					pullCarryoverElasticPx = 0;
				})();
			} else {
				requestAnimationFrame(waitForTop);
			}
		};
		requestAnimationFrame(waitForTop);
	}

	// ─── 生命周期 ────────────────────────────────────────────────

	onMount(() => {
		// 初始化位移：pull 启用时 header 在视口上方（translateY(-PULL_LAYOUT_OFFSET_PX)）
		// mount 时 props 已确定，pullEnabled 读取当前值，无需响应式追踪
		if (contentShiftEl) {
			contentShiftEl.style.transform = computeTranslateY(0);
		}

		// ResizeObserver：感知滚动容器视口宽高变化，通知外部子组件（如 waterfall 触发布局重算）
		viewportObserver = new ResizeObserver(([entry]) => {
			// contentRect 为 content-box（不含 padding），若 scrollContainerClass 含 padding，
			// 则 width 已是去掉 padding 后的可用宽度，子组件可直接用于布局计算
			const w = Math.round(entry.contentRect.width);
			const h = Math.round(entry.contentRect.height);
			onViewportResize?.(w, h);
		});
		viewportObserver.observe(scrollContainer);
	});

	onDestroy(() => {
		viewportObserver?.disconnect();
	});
</script>

<!--
  scrollbar-hidden overflow-y-scroll：使容器可滚动（feedStream scroll 监听依赖此属性）。
-->
<div
	class={cn('h-full w-full overflow-y-scroll', scrollContainerClass)}
	bind:this={scrollContainer}
	use:feedStream={feedStreamOptions}
>
	<!--
    内容位移层：transform 完全由 followShift / animateShift 直接操作 DOM。
    不绑定任何 Svelte style 属性（避免 setAttribute 覆盖 el.style.transition）。
    will-change 由 Svelte style 指令一次性写入，不参与动画路径，无冲突。
  -->
	<div class="w-full" style:will-change="transform" bind:this={contentShiftEl}>
		{#if pullEnabled}
			<!-- header 占位层：h-4 + mb-3 = PULL_LAYOUT_OFFSET_PX (28px)，与 computeTranslateY 补正量对齐 -->
			<div class="mb-3">
				<FeedPullHeader {refreshing} elasticPx={pullDisplayPx} elasticConfig={resolvedElastic} />
			</div>
		{/if}

		{@render children()}

		{#if loadMoreEnabled}
			<FeedStreamFooter {loading} {hasMore} {itemCount} />
		{/if}
	</div>
</div>
