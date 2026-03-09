<!--
  @component WaterfallContainer
  虚拟滚动瀑布流容器，负责布局计算、虚拟滚动和下拉刷新手势。

  职责：
  - 瀑布流布局：贪心最短列算法分配卡片位置
  - 虚拟滚动：仅渲染视口内的卡片，支持线性/二分查找
  - 下拉刷新：通过 pullRefresh action 处理 touch/wheel 手势
  - 卡片高度实测：ResizeObserver 实时监听 DOM 高度并修正布局

  数据由外部通过 props 传入，组件不负责数据获取逻辑。
-->

<script lang="ts" module>
	/**
	 * 瀑布流布局快照。
	 * 只要模块不重新加载就可以一直持有这些数据。
	 */
	interface WaterfallLayoutSnapshot {
		/** 生成该快照时的容器宽度（px） */
		containerWidth: number;
		/** 生成该快照时的卡片间距（px） */
		gap: number;
		/** 参与布局的帖子 ID 顺序，用于校验快照是否仍然对应同一份数据 */
		postIds: string[];
		/** 瀑布流绝对定位结果 */
		cardPositions: CardPosition[];
		/** 各列累计高度 */
		columnHeights: number[];
		/** 已测量高度缓存 */
		measuredHeights: Map<string, number>;
		/** 当前容器总高度 */
		maxHeight: number;
		/** 已完成布局计算的卡片数量 */
		lastCalculatedCount: number;
		/** loadMore 快照计数 */
		snapshotCount: number;
		/** loadMore 前的列高度快照 */
		snapshotColumnHeights: number[];
		/** 当前虚拟滚动可见范围 */
		visibleRange: {
			start: number;
			end: number;
		};
		/** 当前滚动位置 */
		scrollTop: number;
	}

	/** 模块级内存缓存：key 通常使用分类 ID。 */
	const waterfallLayoutSnapshotStore = new Map<string, WaterfallLayoutSnapshot>();
</script>

<script lang="ts">
	import { pullRefresh, type PullRefreshConfig } from '$lib/modules/gesture';
	import type { V1PostPreview } from '$lib/api/types.gen';
	import { Spinner } from '$lib/components/ui/spinner';
	import { breakpoint, remToPx } from '$lib/modules/device';
	import { calculateVisibleRange } from '$lib/modules/virtual-scroll';
	import { onMount, onDestroy } from 'svelte';
	import type { Action } from 'svelte/action';
	import { Spring } from 'svelte/motion';
	import { WaterfallCard, WaterfallSkeletonCard } from '../waterfall-cards';
	import {
		calculateBatchPositions,
		calculateLayoutBase,
		type CardPosition,
		type LayoutItem
	} from './waterfall-layout';
	import { formatStat } from '$lib/utils';
	import { resolveCacheUrl } from '$lib/modules/cache';
	import { DEFAULT_PULL_REFRESH_CONFIG } from '$lib/modules/gesture/pull-refresh.svelte';

	/**
	 * 瀑布流配置项
	 */
	export interface WaterfallConfig {
		/** 最小卡片宽度（px），用于计算列数 */
		minCardWidth: number;
		/** 卡片间距（px），设为 0 时使用响应式间距 */
		gap: number;
		/** 触发加载更多的滚动距离阈值（px） */
		loadingThreshold: number;
		/** 虚拟列表缓冲区大小倍数 */
		bufferSize: number;
		/** 虚拟列表缓冲区基础高度（px） */
		bufferHeight: number;
		/** 使用二分查找的卡片数量阈值 */
		binarySearchThreshold: number;
		/** 下拉刷新配置 */
		pullRefreshConfig: PullRefreshConfig;
	}
	// ─── Props ─────────────────────────────────────────────────────

	let {
		posts,
		loading = false,
		hasMore = true,
		showSkeleton = false,
		refreshing = false,
		categoryId = '',
		onLoadMore,
		onRefresh,
		config
	}: {
		/** 帖子数据列表 */
		posts: V1PostPreview[];
		/** 是否正在加载更多 */
		loading?: boolean;
		/** 是否还有更多数据 */
		hasMore?: boolean;
		/** 是否显示骨架屏 */
		showSkeleton?: boolean;
		/** 是否正在刷新（由外部控制） */
		refreshing?: boolean;
		/** 当前分类 ID（用于清除媒体缓存） */
		categoryId?: string;
		/** 加载更多回调 */
		onLoadMore?: () => void;
		/** 刷新回调，action 会 await 此函数 */
		onRefresh?: () => Promise<void>;
		/** 布局配置（可选，不传则使用默认值） */
		config?: Partial<WaterfallConfig>;
	} = $props();

	// ─── DOM 元素引用 ──────────────────────────────────────────────

	/** 卡片容器元素（用于设置高度） */
	let containerElement: HTMLElement;
	/**
	 * 容器宽度 ResizeObserver：仅观察 scrollContainer，负责感知视口宽度变化。
	 * 故意不观察 containerElement，避免写 containerElement.style.height 时产生
	 * ResizeObserver 反馈循环（"loop completed with undelivered notifications"）。
	 */
	let containerObserver: ResizeObserver;
	/**
	 * 卡片高度 ResizeObserver：仅观察各卡片内层 div，负责感知卡片实际渲染高度。
	 * 单一职责：只做高度测量，不关心容器宽度。
	 */
	let cardObserver: ResizeObserver;
	/** 滚动容器元素 */
	let scrollContainer: HTMLElement;

	// ─── 布局状态 ──────────────────────────────────────────────────

	/** 容器宽度（px） */
	let containerWidth = $state(0);
	/** 各列高度数组 */
	let columnHeights: number[] = $state([]);
	/** 所有卡片的绝对定位信息 */
	let cardPositions: CardPosition[] = $state([]);
	/** 当前虚拟滚动可见范围 */
	let visibleRange = $state({ start: 0, end: 0 });
	/** 瀑布流最大高度（px） */
	let maxHeight = $state(0);
	/** 已计算布局的卡片数量（用于增量计算） */
	let lastCalculatedCount = 0;
	/**
	 * loadMore Pass 1 前的卡片数量快照。
	 * 供 cardObserver Pass 2 回滚用：回到此数量后再做增量重算，避免全量。
	 * 刷新时清零，使 cardObserver 走全量重算路径。
	 */
	let snapshotCount = 0;
	/**
	 * loadMore Pass 1 前的列高度快照。
	 * 与 snapshotCount 配套，回滚列高度后再做增量重算。
	 */
	let snapshotColumnHeights: number[] = [];

	// ─── 下拉刷新 ──────────────────────────────────────────────────

	/** 下拉视觉偏移距离，由 pullRefresh action 驱动 */
	const pullDistance = new Spring(0, { stiffness: 0.1, damping: 0.8 });

	// ─── 滚动节流 ──────────────────────────────────────────────────

	/** 滚动事件 RAF 帧 ID */
	let scrollFrameId: number | null = null;

	// ─── DOM 相关 ──────────────────────────────────────────────

	/** 卡片 DOM 实测高度缓存：key = postId，value = 内层 div 高度（不含 gap） */
	const measuredHeights = new Map<string, number>();

	// ─── 派生数据 ──────────────────────────────────────────────────

	/** 当前可见的帖子切片 */
	let visiblePosts = $derived(posts.slice(visibleRange.start, visibleRange.end + 1));

	// ─── 默认配置 ──────────────────────────────────────────────────
	export const DEFAULT_CONFIG = {
		minCardWidth: 280,
		loadingThreshold: 200,
		pullRefreshConfig: DEFAULT_PULL_REFRESH_CONFIG
	};

	/** 合并后的配置 */
	let mergedConfig = $derived({ ...DEFAULT_CONFIG, ...config });

	// ─── 布局计算 ──────────────────────────────────────────────────

	/**
	 * 计算当前响应式卡片间距（px）。
	 * 该值同时参与布局计算和缓存命中校验，必须保证来源统一。
	 *
	 * @returns 当前布局应使用的 gap 像素值
	 */
	export const resolveGapPx = (): number => {
		return typeof config?.gap === 'number'
			? remToPx(config.gap)
			: breakpoint.isMd
				? remToPx(1)
				: breakpoint.isSm
					? remToPx(0.5)
					: remToPx(0.25);
	};

	/**
	 * 判断缓存快照是否仍然可复用。
	 * 只有容器宽度、gap、帖子顺序完全一致时，历史布局才能安全直接恢复。
	 *
	 * @param snapshot - 待校验的布局快照
	 * @param width - 当前容器宽度
	 * @param gap - 当前布局间距
	 * @returns 快照是否可安全复用
	 */
	function canReuseSnapshot(
		snapshot: WaterfallLayoutSnapshot,
		width: number,
		gap: number
	): boolean {
		if (snapshot.containerWidth !== width) return false;
		if (snapshot.gap !== gap) return false;
		if (snapshot.postIds.length !== posts.length) return false;

		for (let i = 0; i < posts.length; i++) {
			if (snapshot.postIds[i] !== (posts[i].postId || '')) {
				return false;
			}
		}

		return true;
	}

	/**
	 * 将当前组件内的布局状态保存为快照。
	 * 快照在组件卸载后仍然保留，以便相同分类下次挂载时直接恢复。
	 *
	 * @returns 无返回值
	 */
	function persistLayoutSnapshot(): void {
		if (!categoryId || containerWidth <= 0 || cardPositions.length === 0) return;

		waterfallLayoutSnapshotStore.set(categoryId, {
			containerWidth: containerWidth, // 不需要 $state.snapshot，因为不是对象，svelte 不会编译为 Proxy，这里可以取到正常值
			gap: resolveGapPx(),
			postIds: posts.map((post) => post.postId || ''), // map 不返回响应式值，不需要 $state.snapshot
			cardPositions: $state.snapshot(cardPositions), // 必须要 $state.snapshot，因为 cardPositions 是对象，会被编译为 Proxy，这里把 Proxy 转回正常值
			columnHeights: $state.snapshot(columnHeights),
			measuredHeights: new Map(measuredHeights), // 防止获取引用导致出现 bug
			maxHeight: $state.snapshot(maxHeight),
			lastCalculatedCount: $state.snapshot(lastCalculatedCount),
			snapshotCount: $state.snapshot(snapshotCount),
			snapshotColumnHeights: $state.snapshot(snapshotColumnHeights),
			visibleRange: $state.snapshot(visibleRange),
			scrollTop: $state.snapshot(scrollContainer?.scrollTop ?? 0)
		});
	}

	/**
	 * 尝试从缓存恢复布局状态。
	 * 命中后会直接恢复绝对定位、测量高度和滚动位置，避免重挂载触发全量重算。
	 *
	 * @param width - 当前容器宽度
	 * @returns 是否成功恢复
	 */
	function restoreLayoutSnapshot(width: number): boolean {
		if (!categoryId) return false;

		const snapshot = waterfallLayoutSnapshotStore.get(categoryId);
		if (!snapshot) return false;

		const gap = resolveGapPx();
		if (!canReuseSnapshot(snapshot, width, gap)) {
			return false;
		}

		cardPositions = snapshot.cardPositions;
		columnHeights = snapshot.columnHeights;
		maxHeight = snapshot.maxHeight;
		lastCalculatedCount = snapshot.lastCalculatedCount;
		snapshotCount = snapshot.snapshotCount;
		snapshotColumnHeights = snapshot.snapshotColumnHeights;
		visibleRange = snapshot.visibleRange;

		measuredHeights.clear();
		for (const [postId, height] of snapshot.measuredHeights) {
			measuredHeights.set(postId, height);
		}

		if (containerElement) {
			containerElement.style.height = `${maxHeight}px`;
		}

		if (scrollContainer) {
			scrollContainer.scrollTop = snapshot.scrollTop;
		}

		updateVisibleRange();
		return true;
	}

	/**
	 * 重新计算瀑布流布局
	 *
	 * 2 种模式：
	 * - `recalculateLayout()`: 增量计算，仅处理新增的卡片
	 * - `recalculateLayout(true)`: 全量重置，清空位置和列高度后从头计算
	 *
	 * @param reset - 是否全量重置布局状态
	 */

	function recalculateLayout(reset = false): void {
		console.log(reset ? '全量重置布局' : '增量计算布局');
		// 响应式间距
		const gap = resolveGapPx();

		// ── 重置阶段：清空所有布局状态 ──
		if (reset || columnHeights.length === 0) {
			lastCalculatedCount = 0;
			cardPositions.length = 0;
			columnHeights.length = 0;
			maxHeight = 0;
			if (containerElement) containerElement.style.height = '0px';
		}

		if (containerWidth === 0 || posts.length === 0) return;

		// ── 计算基础布局（列数、卡宽）——只调用一次 ──
		const layout = calculateLayoutBase(containerWidth, mergedConfig.minCardWidth, gap);

		// 重置后需要初始化列高度数组
		if (columnHeights.length === 0) {
			columnHeights.push(...Array(layout.columnCount).fill(0));
		}

		// ── 增量计算：仅处理 lastCalculatedCount 之后的新增卡片 ──
		const items: LayoutItem[] = [];
		for (let i = lastCalculatedCount; i < posts.length; i++) {
			items.push({ id: posts[i].postId || '' });
		}

		if (items.length > 0) {
			const result = calculateBatchPositions(items, layout, columnHeights, measuredHeights);
			cardPositions.push(...result.positions);
			maxHeight = result.maxHeight;
		}

		lastCalculatedCount = posts.length;

		if (containerElement) {
			containerElement.style.height = `${maxHeight}px`;
		}
	}

	/**
	 * 更新虚拟滚动可见范围
	 * 根据当前滚动位置计算应渲染哪些卡片
	 */
	function updateVisibleRange(): void {
		if (!scrollContainer || !containerElement) return;

		const result = calculateVisibleRange({
			items: cardPositions,
			scrollTop: scrollContainer.scrollTop,
			viewportHeight: scrollContainer.clientHeight
		});

		visibleRange = result;
	}

	// ─── 卡片高度测量 ──────────────────────────────────────────────

	/**
	 * Svelte action：通过 cardObserver 实时监听卡片内层 div 高度。
	 * cardObserver 检测到高度变化后，会触发 Pass 2（实测修正）布局重算。
	 */
	const measureCardHeight: Action<HTMLElement, string> = (node, postId) => {
		$effect(() => {
			node.dataset.postId = postId;
			cardObserver.observe(node);

			return () => {
				cardObserver.unobserve(node);
			};
		});
	};

	// ─── 滚动事件 ──────────────────────────────────────────────────

	/**
	 * 处理滚动事件（RAF 节流）
	 * 更新虚拟滚动范围并检查是否需要加载更多
	 */
	function handleScroll() {
		if (scrollFrameId !== null) return;

		scrollFrameId = requestAnimationFrame(async () => {
			updateVisibleRange();

			if (!scrollContainer) {
				scrollFrameId = null;
				return;
			}

			const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

			// 接近底部时触发加载更多
			if (
				scrollHeight - scrollTop - clientHeight < mergedConfig.loadingThreshold &&
				hasMore &&
				!loading
			) {
				await onLoadMore?.();
				// 保存 Pass 1 前的快照，供 cardObserver Pass 2 回滚增量用
				snapshotCount = lastCalculatedCount;
				snapshotColumnHeights = [...columnHeights];
				// Pass 1：新卡片尚无实测高度，用占位值先算一次，让卡片立即可见
				// Pass 2 由 cardObserver 在新卡片实测完毕后自动触发（增量修正）
				recalculateLayout();
				updateVisibleRange();
			}

			scrollFrameId = null;
		});
	}

	const refreshDataAndLayout = async (): Promise<void> => {
		// 清空旧测量值，确保新卡片从零开始实测
		measuredHeights.clear();
		// 清除 loadMore 快照：刷新后新卡片的首次测量不应走增量路径，
		// cardObserver 会因 snapshotCount === 0 自动走全量重算
		snapshotCount = 0;
		snapshotColumnHeights = [];

		await onRefresh?.();
		pullDistance.target = 0;
		// 布局重算由 cardObserver 在新卡片首次测量时自动触发（全量重算，因无快照）
	};

	// ─── 生命周期 ──────────────────────────────────────────────────

	onMount(() => {
		if (!containerElement || !scrollContainer) return;

		// 恢复布局
		console.log(
			restoreLayoutSnapshot(containerElement.clientWidth) ? '可以恢复布局' : '不能恢复布局'
		);

		// ── containerObserver：仅监听滚动容器宽度 ──────────────────────────────
		// 挂在 scrollContainer（外层），不挂 containerElement（内层）。
		// 原因：recalculateLayout 会写 containerElement.style.height，若同时观察它，
		// 高度写入会触发新一轮通知，形成反馈循环，导致
		// "ResizeObserver loop completed with undelivered notifications" 错误。
		// iOS WKWebView 会将此作为未捕获错误抛出。
		// 改为观察外层 scrollContainer 后，写内层高度不影响外层宽度，循环天然断开。
		containerObserver = new ResizeObserver(([entry]) => {
			const w = entry.contentRect.width;
			if (w === containerWidth) return; // 宽度未变，跳过
			containerWidth = w;

			if (
				waterfallLayoutSnapshotStore.get(categoryId) &&
				canReuseSnapshot(waterfallLayoutSnapshotStore.get(categoryId)!, w, resolveGapPx())
			)
				return;
			recalculateLayout(true);
			updateVisibleRange();
		});

		// ── cardObserver：仅监听卡片实测高度（两步布局流程的 Pass 2）──────────
		//
		// Pass 1 由业务逻辑显式触发（handleScroll / refreshDataAndLayout），
		//        用占位高度先让卡片快速出现；
		// Pass 2（本回调）在卡片渲染完毕后自动触发，用真实高度修正布局。
		//
		// 高度变化分两类，处理策略不同：
		//   ① 新卡片首次测量（prev === undefined）：
		//        - 有快照（loadMore 触发）→ 回滚快照 + 增量重算（只算新增卡片）
		//        - 无快照（刷新 / 首次加载）  → 全量重算
		//   ② 已有卡片高度变化（prev !== undefined，如骨架屏→真实内容）：
		//        → 该卡片后续所有卡片列位置均受影响，必须全量重算
		//
		// 高度守卫（prev === h → skip）保证高度稳定后不再触发，自然收敛。
		cardObserver = new ResizeObserver((entries) => {
			let hasNewCard = false; // 首次测量（prev === undefined）
			let hasChangedCard = false; // 已有高度更新（prev 有值但变了）

			for (const entry of entries) {
				const postId = (entry.target as HTMLElement).dataset.postId;
				if (!postId) continue;
				const h = entry.contentRect.height;
				const prev = measuredHeights.get(postId);
				// 高度守卫：值未变则跳过，切断反馈环
				if (prev !== h) {
					measuredHeights.set(postId, h);
					if (prev === undefined) {
						hasNewCard = true;
					} else {
						hasChangedCard = true;
					}
				}
			}

			// 如果还能重用快照，则跳过计算
			if (
				waterfallLayoutSnapshotStore.get(categoryId) &&
				canReuseSnapshot(
					waterfallLayoutSnapshotStore.get(categoryId)!,
					containerWidth,
					resolveGapPx()
				)
			)
				return;

			if (!hasNewCard && !hasChangedCard) return;
			if (hasChangedCard) {
				// ② 已有卡片高度变化 → 全量重算
				recalculateLayout(true);
				updateVisibleRange();
				return;
			}

			// hasNewCard
			// ① 新卡片首次测量
			if (snapshotCount > 0) {
				// loadMore Pass 2：回滚到 Pass 1 前的快照，用实测高度做增量重算
				// 只重算新增卡片（snapshotCount 之后），性能优于全量
				cardPositions.length = snapshotCount;
				columnHeights = [...snapshotColumnHeights];
				lastCalculatedCount = snapshotCount;
				maxHeight = snapshotColumnHeights.length > 0 ? Math.max(...snapshotColumnHeights) : 0;
				snapshotCount = 0;
				snapshotColumnHeights = [];
				recalculateLayout(); // 增量：从快照位置开始计算新卡片
				updateVisibleRange();
			} else {
				// 无快照：刷新后 / 首次加载的首次测量 → 全量重算
				recalculateLayout(true);
				updateVisibleRange();
			}
		});

		containerObserver.observe(scrollContainer);
		scrollContainer.addEventListener('scroll', handleScroll);
	});

	onDestroy(() => {
		persistLayoutSnapshot();
		containerObserver?.disconnect();
		cardObserver?.disconnect();
		scrollContainer?.removeEventListener('scroll', handleScroll);
		if (scrollFrameId !== null) {
			cancelAnimationFrame(scrollFrameId);
			scrollFrameId = null;
		}
	});

	// ─── 暴露给外部的方法 ──────────────────────────────────────────

	/**
	 * 滚动到顶部并触发下拉刷新动画
	 * 用于外部程序化触发刷新（如点击刷新按钮、首页 Tab 二次点击）
	 */
	export function scrollToTopAndRefresh(): void {
		if (scrollContainer) {
			scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });

			const checkScrollAndRefresh = () => {
				// 组件可能在 rAF 回调触发前已被销毁，scrollContainer 会被 bind:this 置为 null
				if (!scrollContainer) return;

				if (scrollContainer.scrollTop <= 0) {
					pullDistance.target = mergedConfig.pullRefreshConfig.triggeredDistance;
					refreshDataAndLayout();
				} else {
					requestAnimationFrame(checkScrollAndRefresh);
				}
			};
			requestAnimationFrame(checkScrollAndRefresh);
		} else {
			refreshDataAndLayout();
		}
	}
</script>

<!-- 滚动容器 + 下拉刷新 action -->
<div
	class="h-full overflow-y-scroll px-1 sm:px-2 md:px-4 lg:px-6"
	bind:this={scrollContainer}
	use:pullRefresh={{
		pullDistance,
		config: mergedConfig.pullRefreshConfig,
		onRefresh: refreshDataAndLayout
	}}
>
	<!-- 内容区域：通过 translateY 跟随下拉距离移动 -->
	<div
		class="h-full w-full"
		style="transform: translateY({pullDistance.current - 16 - 12}px); will-change: transform;"
		bind:this={containerElement}
	>
		<!-- 下拉刷新指示器 -->
		<div class="flex h-4 items-end justify-center">
			{#if refreshing}
				<Spinner class="mr-2 text-primary" />
				<span class="text-sm text-muted-foreground">正在刷新</span>
			{:else if pullDistance.current >= mergedConfig.pullRefreshConfig.triggerThreshold}
				<div
					class="mr-2 text-primary"
					style="transform: rotate({Math.min(
						(pullDistance.current / mergedConfig.pullRefreshConfig.triggerThreshold) * 360,
						360
					)}deg);"
				>
					<Spinner class="animate-none!" />
				</div>
				<span class="text-sm text-muted-foreground">释放刷新</span>
			{:else}
				<div
					class="mr-2 text-primary"
					style="transform: rotate({Math.min(
						(pullDistance.current / mergedConfig.pullRefreshConfig.triggerThreshold) * 360,
						360
					)}deg);"
				>
					<Spinner class="animate-none!" />
				</div>
				<span class="text-sm text-muted-foreground">下拉刷新</span>
			{/if}
		</div>

		<!-- 瀑布流卡片区域 -->
		<div class="relative mt-3 h-full w-full">
			{#each visiblePosts as post, i (post.postId)}
				{@const absoluteIndex = visibleRange.start + i}
				<div
					class="absolute"
					style="top: {cardPositions[absoluteIndex]?.top}px; left: {cardPositions[absoluteIndex]
						?.left}px; width: {cardPositions[absoluteIndex]?.width}px; height: {cardPositions[
						absoluteIndex
					]?.height}px;"
				>
					<div use:measureCardHeight={post.postId || ''}>
						{#if showSkeleton}
							<WaterfallSkeletonCard
								aspectRatio={post.cover?.single?.meta?.width && post.cover.single.meta?.height
									? post.cover.single.meta.width / post.cover.single.meta.height
									: 1}
							/>
						{:else}
							<WaterfallCard
								index={i}
								postId={post.postId || ''}
								title={post.displayTitle || ''}
								cover={{
									url: resolveCacheUrl(post.cover?.single?.url || '', `feed-${categoryId}`), // 添加 feed 前缀以避免缓存桶命名冲突
									ratio:
										post.cover?.single?.meta?.width && post.cover.single.meta?.height
											? post.cover.single.meta.width / post.cover.single.meta.height
											: 1
								}}
								author={{
									avatar: resolveCacheUrl(post.author?.avatar, `feed-${categoryId}`),
									name: post.author?.name || '',
									id: post.author?.userId || ''
								}}
								likeCount={formatStat(post.stats?.likeCount) || '0'}
								viewCount={formatStat(post.stats?.viewCount) || '0'}
								isLiked={post.relationStatus?.isLiked || false}
								isOnlyVideo={post.isOnlyVideo || false}
								publishTime={parseInt(post.publishTime || '0')}
							/>
						{/if}
					</div>
				</div>
			{/each}

			<!-- 底部加载更多指示器 -->
			{#if loading && posts.length > 0}
				<div
					class="absolute right-0 left-0 flex items-center justify-center py-4"
					style="top: {maxHeight}px;"
				>
					<Spinner class="mr-2 text-primary" />
					<span class="text-sm text-muted-foreground">加载中</span>
				</div>
			{/if}

			<!-- 底部没有更多数据提示 -->
			{#if !hasMore && posts.length > 0}
				<div
					class="absolute right-0 left-0 py-4 text-center text-sm text-muted-foreground"
					style="top: {maxHeight}px;"
				>
					没有更多内容了
				</div>
			{/if}
		</div>
	</div>
</div>
