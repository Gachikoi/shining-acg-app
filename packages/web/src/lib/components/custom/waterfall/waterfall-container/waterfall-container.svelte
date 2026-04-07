<!--
  @component WaterfallContainer
  虚拟滚动瀑布流容器，负责布局计算与虚拟滚动。

  职责：
  - 瀑布流布局：贪心最短列算法分配卡片绝对位置
  - 虚拟滚动：仅渲染视口内的卡片，支持线性/二分查找
  - 卡片高度实测：ResizeObserver 实时监听 DOM 高度并修正布局

  下拉刷新、触底加载、弹性动画：完全委托给 FeedContainer，通过
  `onViewportResize` / `onScrollFrame` / `getContentHeight` / `onRefresh` / `onLoadMore` 回调接入。

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
		/** 参与布局的帖子引用，用于校验快照是否仍然对应同一份数据 */
		postRef: V1PostPreview[];
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
		visibleRange: { start: number; end: number };
		/** 当前滚动位置 */
		scrollTop: number;
	}

	/** 模块级内存缓存：key 通常使用分类 ID。 */
	const waterfallLayoutSnapshotStore = new Map<string, WaterfallLayoutSnapshot>();
</script>

<script lang="ts">
	import type { V1PostPreview } from '$lib/api/types.gen';
	import FeedContainer from '$lib/components/custom/feed-container/feed-container.svelte';
	import { breakpoint, remToPx } from '$lib/modules/device';
	import { DEFAULT_FEED_STREAM_CONFIG, type FeedStreamConfig } from '$lib/modules/gesture';
	import { cn } from '$lib/utils.js';
	import {
		calculatePositionedVisibleRange,
		DEFAULT_VIRTUAL_SCROLL_RANGE,
		type VirtualScrollRangeConfig
	} from '$lib/utils/virtual-scroll';
	import { onDestroy, onMount } from 'svelte';
	import type { Action } from 'svelte/action';
	import { WaterfallCard, WaterfallSkeletonCard } from '../waterfall-cards';
	import {
		calculateBatchPositions,
		calculateLayoutBase,
		type CardPosition,
		type LayoutItem
	} from './waterfall-layout';

	/**
	 * 瀑布流配置项
	 */
	export interface WaterfallConfig {
		/** 最小卡片宽度（px），用于计算列数 */
		minCardWidth: number;
		/** 卡片间距（px），设为 0 时使用响应式间距 */
		gap: number;
		/** 虚拟滚动可见区缓冲与二分策略（与 `calculatePositionedVisibleRange` 参数一致） */
		virtualScrollRange: VirtualScrollRangeConfig;
		/** Feed 流手势配置（传给 FeedContainer，与默认浅合并） */
		feedElasticConfig: Partial<FeedStreamConfig>;
	}

	// ─── Props ─────────────────────────────────────────────────────

	let {
		posts,
		loading = false,
		hasMore = true,
		showSkeleton = false,
		refreshing = false,
		businessId,
		categoryId,
		isShowViews = true,
		isShowTime = true,
		onLoadMore,
		onRefresh,
		config,
		scrollContainerClass
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
		/** 当前分类 ID（用于图片缓存） */
		businessId: string;
		categoryId: string;
		/** 是否展示封面浏览量角标（透传给 WaterfallCard） */
		isShowViews?: boolean;
		/** 是否展示作者区发布时间（透传给 WaterfallCard） */
		isShowTime?: boolean;
		/** 加载更多回调 */
		onLoadMore?: () => void;
		/** 刷新回调，FeedContainer 会 await 此函数后执行回弹动画 */
		onRefresh?: () => Promise<void>;
		/** 布局配置（可选，不传则使用默认值） */
		config?: Partial<WaterfallConfig>;
		/** 滚动容器额外 class（如官网全宽：px-0） */
		scrollContainerClass?: string;
	} = $props();

	// ─── FeedContainer 实例引用 ──────────────────────────────────

	/**
	 * FeedContainer 组件实例，通过 `bind:this` 获取。
	 * 用于调用 `scrollTo` / `scrollToTopAndRefresh`，无需持有原始 DOM 元素。
	 */
	let feedContainerRef: ReturnType<typeof FeedContainer> | undefined = $state();

	// ─── DOM 元素引用 ──────────────────────────────────────────────

	/** 卡片绝对定位容器元素（用于设置高度） */
	let containerElement: HTMLElement;
	/**
	 * 卡片高度 ResizeObserver：仅观察各卡片内层 div，负责感知卡片实际渲染高度。
	 * 单一职责：只做高度测量，不关心容器宽度（视口宽高由 FeedContainer 的 onViewportResize 提供）。
	 */
	let cardObserver: ResizeObserver;

	// ─── 布局状态 ──────────────────────────────────────────────────

	/** 视口宽度（px），由 FeedContainer.onViewportResize 回调更新 */
	let containerWidth = $state(0);
	/** 视口高度（px），由 FeedContainer.onViewportResize 回调更新 */
	let containerHeight = $state(0);
	/** 各列高度数组 */
	let columnHeights: number[] = $state([]);
	/** 所有卡片的绝对定位信息 */
	let cardPositions: CardPosition[] = $state([]);
	/** 当前虚拟滚动可见范围 */
	let visibleRange = $state({ start: 0, end: 0 });
	/** 缓存的容器滚动位置（px），由 onScrollFrame 同步，避免读取 scrollTop 引发强制回流 */
	let currentScrollTop = $state(0);
	/** 瀑布流内容总高度（px） */
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

	// ─── DOM 相关 ──────────────────────────────────────────────────

	/** 卡片 DOM 实测高度缓存：key = postId，value = 内层 div 高度（不含 gap） */
	let measuredHeights = new Map<string, number>();

	// ─── 派生数据 ──────────────────────────────────────────────────

	/** 当前可见的帖子切片 */
	let visiblePosts = $derived(posts.slice(visibleRange.start, visibleRange.end + 1));

	// ─── 默认配置 ──────────────────────────────────────────────────

	export const DEFAULT_CONFIG = {
		minCardWidth: 280,
		virtualScrollRange: { ...DEFAULT_VIRTUAL_SCROLL_RANGE },
		feedElasticConfig: { ...DEFAULT_FEED_STREAM_CONFIG }
	};

	/** 合并后的配置（嵌套对象做浅合并，便于 `config` 只覆盖部分字段） */
	let mergedConfig = $derived({
		...DEFAULT_CONFIG,
		...config,
		virtualScrollRange: {
			...DEFAULT_CONFIG.virtualScrollRange,
			...config?.virtualScrollRange
		},
		feedElasticConfig: {
			...DEFAULT_FEED_STREAM_CONFIG,
			...config?.feedElasticConfig
		}
	});

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
	 * 只有容器宽度、gap、帖子引用完全一致时，历史布局才能安全直接恢复。
	 *
	 * @param businessId - 业务 ID
	 * @param categoryId - 分类 ID
	 * @param containerWidth - 容器宽度
	 * @returns 可复用快照，否则 null
	 */
	function getReusableSnapshot(
		businessId: string,
		categoryId: string,
		containerWidth: number
	): WaterfallLayoutSnapshot | null {
		const snapshot = waterfallLayoutSnapshotStore.get(`${businessId}:${categoryId}`);
		if (!snapshot) return null;
		if (snapshot.containerWidth !== containerWidth) return null;
		if (snapshot.gap !== resolveGapPx()) return null;
		// feed-store 等更新数据时 posts 引用会变，故用引用相等判断快照是否仍对应同一份列表
		if (snapshot.postRef !== posts) return null;
		return snapshot;
	}

	/**
	 * 将当前组件内的布局状态保存为快照。
	 * 快照在组件卸载后仍然保留，以便相同分类下次挂载时直接恢复。
	 */
	function persistLayoutSnapshot(): void {
		if (!categoryId || containerWidth <= 0 || cardPositions.length === 0 || posts.length === 0)
			return;

		waterfallLayoutSnapshotStore.set(`${businessId}:${categoryId}`, {
			// 标量无需 $state.snapshot（非 Proxy），直接存即可
			containerWidth,
			gap: resolveGapPx(),
			postRef: posts,
			// 数组经 $state 编译为 Proxy，需 snapshot 再持久化，避免存到 Map 里仍是活 Proxy
			cardPositions: $state.snapshot(cardPositions),
			columnHeights: $state.snapshot(columnHeights),
			// 复制 Map，避免外部仍持有同一引用导致后续读写串味
			measuredHeights: new Map(measuredHeights),
			maxHeight: $state.snapshot(maxHeight),
			lastCalculatedCount: $state.snapshot(lastCalculatedCount),
			snapshotCount: $state.snapshot(snapshotCount),
			snapshotColumnHeights: $state.snapshot(snapshotColumnHeights),
			visibleRange: $state.snapshot(visibleRange),
			scrollTop: $state.snapshot(currentScrollTop)
		});
	}

	/**
	 * 尝试从缓存恢复布局状态。
	 * 命中后会直接恢复绝对定位、测量高度和滚动位置，避免重挂载触发全量重算。
	 *
	 * 计算顺序：先写回内存中的布局与测量缓存 → 同步 `containerElement` 总高度 →
	 * 恢复滚动位置与 `currentScrollTop` → `updateVisibleRange()` 按当前滚动算可见切片。
	 *
	 * @param businessId - 业务 ID
	 * @param categoryId - 分类 ID
	 * @param containerWidth - 容器宽度（防止 $state 与 DOM 不同步，必须显式传入当前宽）
	 * @returns 是否成功恢复
	 */
	function restoreLayoutSnapshot(
		businessId: string,
		categoryId: string,
		containerWidth: number
	): boolean {
		const snapshot = getReusableSnapshot(businessId, categoryId, containerWidth);
		if (!snapshot) return false;

		cardPositions = snapshot.cardPositions;
		columnHeights = snapshot.columnHeights;
		maxHeight = snapshot.maxHeight;
		lastCalculatedCount = snapshot.lastCalculatedCount;
		snapshotCount = snapshot.snapshotCount;
		snapshotColumnHeights = snapshot.snapshotColumnHeights;
		visibleRange = snapshot.visibleRange;
		// persist 时已 `new Map` 拷贝，此处拿到的是独立副本，可与当前组件内 Map 安全替换
		measuredHeights = snapshot.measuredHeights;

		if (containerElement) {
			containerElement.style.height = `${maxHeight}px`;
		}

		// 通过 FeedContainer 的 scrollTo 恢复 scrollTop，并同步 currentScrollTop，供虚拟滚动与后续 Pass 2 一致
		feedContainerRef?.scrollTo({ top: snapshot.scrollTop, behavior: 'instant' });
		currentScrollTop = snapshot.scrollTop;

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
	 * 单次调用内的流程：`resolveGapPx` →（可选）清空状态 → `calculateLayoutBase` 得列数与卡宽 →
	 * 初始化列高 → 对 `[lastCalculatedCount, posts.length)` 做 `calculateBatchPositions` → 更新 `lastCalculatedCount` 与容器高度。
	 *
	 * @param reset - 是否全量重置布局状态
	 */
	function recalculateLayout(reset = false): void {
		// 响应式间距（与快照校验、列宽计算同源）
		const gap = resolveGapPx();

		// ── 重置阶段：清空布局状态，全量模式或列高尚未初始化时进入 ──
		if (reset || columnHeights.length === 0) {
			lastCalculatedCount = 0;
			cardPositions.length = 0;
			columnHeights.length = 0;
			maxHeight = 0;
			if (containerElement) containerElement.style.height = '0px';
		}

		if (containerWidth === 0 || posts.length === 0) return;

		// ── 基础布局：列数、单列卡片宽度（本函数内只算一次）──
		const layout = calculateLayoutBase(containerWidth, mergedConfig.minCardWidth, gap);

		// 重置后需按当前列数建立列高数组，供贪心落位累加
		if (columnHeights.length === 0) {
			columnHeights.push(...Array(layout.columnCount).fill(0));
		}

		// ── 增量阶段：只处理 lastCalculatedCount 起的新增帖子，占位/实测高度来自 measuredHeights ──
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
	 * 更新虚拟滚动可见范围。
	 * 完全依赖缓存的 currentScrollTop 和 containerHeight 避免布局抖动。
	 */
	function updateVisibleRange(): void {
		if (!containerElement || containerHeight === 0) return;

		const result = calculatePositionedVisibleRange({
			items: cardPositions,
			scrollTop: currentScrollTop,
			viewportHeight: containerHeight,
			...mergedConfig.virtualScrollRange
		});

		visibleRange = result;
	}

	// ─── FeedContainer 回调 ──────────────────────────────────────

	/**
	 * FeedContainer 视口尺寸变化通知。
	 * 替代原先在本组件内 `containerObserver.observe(scrollContainer)` 的做法：
	 * FeedContainer 只观察外层滚动容器（content-box），不观察内层 `containerElement`。
	 * 这样 `recalculateLayout` 写入 `containerElement.style.height` 不会触发被观察元素的尺寸回调，
	 * 避免 ResizeObserver 反馈环与 WKWebView 上的 “loop completed with undelivered notifications”。
	 * 首次触发时优先尝试恢复布局快照；失败则全量重算。
	 *
	 * @param w - 滚动容器内容宽度（px）
	 * @param h - 滚动容器可见高度（px）
	 */
	function handleViewportResize(w: number, h: number): void {
		const widthChanged = w !== containerWidth;
		const heightChanged = h !== containerHeight;
		if (!widthChanged && !heightChanged) return;

		containerWidth = w;
		containerHeight = h;

		if (restoreLayoutSnapshot(businessId, categoryId, containerWidth)) return;
		recalculateLayout(true);
		updateVisibleRange();
	}

	/**
	 * FeedContainer scroll RAF 回调，同步 scrollTop 并更新虚拟滚动可见范围。
	 *
	 * @param scrollTop - 当前滚动位置（px）
	 */
	function handleScrollFrame({ scrollTop }: { scrollTop: number }): void {
		currentScrollTop = scrollTop;
		updateVisibleRange();
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

	/**
	 * 刷新时的数据 + 布局清理：清空旧测量值与 loadMore 快照，然后调用外部 onRefresh。
	 * 该函数作为 `onRefresh` 传给 FeedContainer，由 FeedContainer 在动画合适时机调用。
	 */
	const refreshDataAndLayout = async (): Promise<void> => {
		measuredHeights.clear();
		snapshotCount = 0;
		snapshotColumnHeights = [];
		await onRefresh?.();
	};

	/**
	 * feedStream 触底后执行：快照 + Pass1 布局 + 可见区更新。
	 */
	async function runLoadMoreLayout(): Promise<void> {
		await onLoadMore?.();
		snapshotCount = lastCalculatedCount;
		snapshotColumnHeights = [...columnHeights];
		recalculateLayout();
		updateVisibleRange();
	}

	// ─── 生命周期 ──────────────────────────────────────────────────

	onMount(() => {
		// ── cardObserver：仅监听卡片实测高度（两步布局流程的 Pass 2）──────────
		//
		// Pass 1 由业务逻辑显式触发（feedStream 触底 / refreshDataAndLayout），
		//        用占位高度先让卡片快速出现；
		// Pass 2（本回调）在卡片渲染完毕后自动触发，用真实高度修正布局。
		//
		// 高度变化分两类，处理策略不同：
		//   ① 新卡片首次测量（prev === undefined）：
		//        - 有快照（loadMore 触发）→ 回滚快照 + 增量重算（只算新增卡片）
		//        - 无快照（刷新 / 首次加载）→ 全量重算
		//   ② 已有卡片高度变化（prev !== undefined，如骨架屏→真实内容）：
		//        → 该卡及之后列位置均受影响，必须全量重算
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

			// 若快照仍可复用（例如刚恢复布局），跳过后续重算
			if (getReusableSnapshot(businessId, categoryId, containerWidth)) return;
			if (!hasNewCard && !hasChangedCard) return;

			if (hasChangedCard) {
				// ② 已有卡片高度变化 → 全量重算
				recalculateLayout(true);
				updateVisibleRange();
				return;
			}

			// hasNewCard：① 新卡片首次测量
			if (snapshotCount > 0) {
				// loadMore Pass 2：回滚到 Pass 1 前的快照，用实测高度做增量重算
				// 只重算新增卡片（snapshotCount 之后），性能优于全量
				cardPositions.length = snapshotCount;
				columnHeights = [...snapshotColumnHeights];
				lastCalculatedCount = snapshotCount;
				maxHeight = snapshotColumnHeights.length > 0 ? Math.max(...snapshotColumnHeights) : 0;
				snapshotCount = 0;
				snapshotColumnHeights = [];
				recalculateLayout(); // 增量：从快照位置起算新卡片
				updateVisibleRange();
			} else {
				// 无快照：刷新后 / 首次加载的首次测量 → 全量重算
				recalculateLayout(true);
				updateVisibleRange();
			}
		});
	});

	onDestroy(() => {
		persistLayoutSnapshot();
		cardObserver?.disconnect();
	});

	// ─── 暴露给外部的方法 ──────────────────────────────────────────

	/**
	 * 滚动到顶部并触发下拉刷新动画。
	 * 用于外部程序化触发刷新（如 Tab 二次点击、顶部刷新按钮）。
	 * 完整动画逻辑由 FeedContainer 处理，waterfall 仅委托。
	 */
	export function scrollToTopAndRefresh(): void {
		feedContainerRef?.scrollToTopAndRefresh();
	}
</script>

<FeedContainer
	bind:this={feedContainerRef}
	{loading}
	{hasMore}
	{showSkeleton}
	{refreshing}
	itemCount={posts.length}
	elasticConfig={mergedConfig.feedElasticConfig}
	features={{ pull: !!onRefresh, loadMore: true }}
	onRefresh={onRefresh ? refreshDataAndLayout : undefined}
	onLoadMore={runLoadMoreLayout}
	onScrollFrame={handleScrollFrame}
	onViewportResize={handleViewportResize}
	scrollContainerClass={cn('px-1 sm:px-2 md:px-4 lg:px-6', scrollContainerClass)}
>
	<!--
    瀑布流卡片区域：绝对定位 + 占位高度。
    注意：padding 已移至 scrollContainerClass（由 FeedContainer 的 ResizeObserver 在 content-box
    层面报告），故此处 containerElement 的 clientWidth 直接等于 containerWidth（已减去 padding），
    不再需要在卡片布局计算中手动减去 padding。
  -->
	<div class="relative w-full" style="min-height: {maxHeight}px;" bind:this={containerElement}>
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
							{post}
							index={absoluteIndex}
							{businessId}
							{categoryId}
							{isShowViews}
							{isShowTime}
						/>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</FeedContainer>
