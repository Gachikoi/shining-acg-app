<!--
  @component Home 页面
  Feed 流首页，通过 SwipeablePane 实现分类之间的滑动切换。

  核心架构：
  - CategoryTabs：顶部分类按钮组
  - SwipeablePane：3 面板虚拟窗口，支持手势滑动和非相邻跳转
  - FeedStore<T>：泛型数据 store，按 contentType 创建不同类型的实例
  - WaterfallContainer（V1PostPreview）/ FeedList（V1UserSummary）：根据分类渲染

  API 请求逻辑、缓存适配器等已提取至 feed-api.ts，页面只负责：
  - 筛选状态管理
  - 容器尺寸感知（getDynamicNeedNum）
  - 组件编排和路由
-->
<script lang="ts">
	import { SwipeablePane, type CategoryOption } from '$lib/components/custom/swipeable-pane';
	import { WaterfallContainer } from '$lib/components/custom/waterfall';
	import { Button } from '$lib/components/ui/button';
	import { appBus } from '$lib/events/app-bus';
	import { createDbCache } from '$lib/modules/cache';
	import {
		POST_CACHE_ADAPTER,
		USER_CACHE_ADAPTER,
		createFeedRouteStateStore,
		createFeedStore,
		createPostFetchFn,
		createUserFetchFn,
		estimateNeedNum,
		feedStores,
		generatePostSkeletons,
		generateUserSkeletons,
		getPostId,
		getUserId,
		type FeedStore,
		type HomeFeedRouteStateSnapshot
	} from '$lib/stores/feed';
	import { LucideRefreshCw } from 'lucide-svelte';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	import type {
		V1FeedFilter,
		V1GetFeedResponse,
		V1PostPreview,
		V1UserSummary
	} from '$lib/api/types.gen';
	import FeedList from '$lib/components/custom/feed-list/feed-list.svelte';
	import { BusinessIds } from '$lib/constants';
	import { remToPx } from '$lib/modules/device';
	import { cn } from '$lib/utils';
	import type { Snapshot } from '../$types';

	const homeFeedRouteState = createFeedRouteStateStore();

	/**
	 * 保存 Home 页面对应 history entry 的路由级快照。
	 *
	 * 虽然页面状态已提升到模块级单例中，但这里仍保留 SvelteKit snapshot：
	 * 这样在浏览器前进/后退时，仍能按 history entry 维度恢复当时的筛选状态，
	 * 而不仅仅是复用“最近一次”的全局单例值。
	 */
	export const snapshot: Snapshot<HomeFeedRouteStateSnapshot> = {
		capture: homeFeedRouteState.capture,
		restore: (snapshot) => {
			homeFeedRouteState.restore(snapshot);
			swipeablePaneRef?.updatePanels(snapshot.categoryIndex); // 恢复路由状态后重建 panels
		}
	};

	// ─── 缓存 ──────────────────────────────────────────────────────

	const feedCache = createDbCache<V1GetFeedResponse>(BusinessIds.FEED);

	// ─── 分类配置 ──────────────────────────────────────────────────

	const CATEGORY_OPTIONS: CategoryOption[] = [
		{ label: '综合', value: 'general', contentType: 'waterfall' },
		{ label: '关注', value: 'following', contentType: 'waterfall' },
		{ label: '用户', value: 'user', contentType: 'list' },
		{ label: '模玩', value: 'shining', contentType: 'waterfall' },
		{ label: '绘画', value: 'painting', contentType: 'waterfall' },
		{ label: '轻文', value: 'light_novel', contentType: 'waterfall' },
		{ label: '小说', value: 'novel', contentType: 'waterfall' },
		{ label: '音乐', value: 'music', contentType: 'waterfall' },
		{ label: '游戏', value: 'game', contentType: 'waterfall' },
		{ label: '其他', value: 'other', contentType: 'waterfall' }
	];

	/** 内容区容器 DOM 引用 */
	let contentAreaEl: HTMLElement | undefined = $state();
	let contentAreaWidth = $state(0);
	let contentAreaHeight = $state(0);

	/** 筛选上下文 getter——注入到 feed-api 的 fetch 工厂中 */
	function getFilters(): V1FeedFilter {
		return {
			keyword: homeFeedRouteState.state.keyword,
			orderType: homeFeedRouteState.state.orderType,
			timeRange: homeFeedRouteState.state.timeRange,
			authorId: homeFeedRouteState.state.authorId
		};
	}

	/**
	 * 获取或创建指定分类的 FeedStore
	 *
	 * @param categoryId - 分类 ID
	 * @returns FeedStore 实例
	 */
	function getOrCreateStore(
		categoryId: string,
		contentAreaWidth: number,
		contentAreaHeight: number
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): FeedStore<any> {
		let store = feedStores.get(categoryId);
		if (store) return store;

		const contentType =
			CATEGORY_OPTIONS.find((c) => c.value === categoryId)?.contentType ?? 'waterfall';
		const onError = (_error: unknown) => {
			toast.error('网络请求失败，请检查您的网络连接');
		};

		if (contentType === 'list') {
			store = createFeedStore<V1UserSummary>(categoryId, {
				needNum: estimateNeedNum('list', {
					containerWidth: contentAreaWidth,
					containerHeight: contentAreaHeight,
					minItemWidth: contentAreaWidth,
					avgItemRatio: remToPx(6.25) / contentAreaWidth, // 13 为用户列表项高度大致的 rem 值
					gap: 0
				}),
				cache: feedCache,
				cacheAdapter: USER_CACHE_ADAPTER,
				getItemId: getUserId,
				generateSkeleton: generateUserSkeletons,
				fetchFn: createUserFetchFn(getFilters),
				onError
			});
		} else {
			const ref = feedRefs[categoryId];
			const waterfallRef = isWaterfallRef(ref) ? ref : undefined;
			store = createFeedStore<V1PostPreview>(categoryId, {
				needNum: estimateNeedNum('waterfall', {
					containerWidth: contentAreaWidth,
					containerHeight: contentAreaHeight,
					gap: waterfallRef?.resolveGapPx() ?? 8,
					minItemWidth: waterfallRef?.DEFAULT_CONFIG.minCardWidth ?? 280
				}),
				cache: feedCache,
				cacheAdapter: POST_CACHE_ADAPTER,
				getItemId: getPostId,
				generateSkeleton: generatePostSkeletons,
				fetchFn: createPostFetchFn(getFilters),
				onError
			});
		}

		store.init();
		feedStores.set(categoryId, store);
		return store;
	}

	// ─── SwipeablePane 引用 ──────────────────────────────────────

	let swipeablePaneRef: ReturnType<typeof SwipeablePane> | undefined = $state();

	/**
	 * 各面板 Feed 组件实例字典。
	 * 值为 WaterfallContainer 或 FeedList 实例，两者均暴露 scrollToTopAndRefresh()。
	 */
	let feedRefs = $state<
		Record<string, ReturnType<typeof WaterfallContainer> | ReturnType<typeof FeedList> | undefined>
	>({});

	/**
	 * WaterfallContainer 实例类型守卫。
	 * 以 `resolveGapPx` 方法作为判别属性：该方法仅存在于 WaterfallContainer，
	 * FeedList 没有此方法，可安全用于收窄联合类型。
	 *
	 * @param ref - feedRefs 中的组件实例（联合类型）
	 * @returns ref 是否为 WaterfallContainer 实例
	 */
	function isWaterfallRef(
		ref: ReturnType<typeof WaterfallContainer> | ReturnType<typeof FeedList> | undefined
	): ref is ReturnType<typeof WaterfallContainer> {
		return ref != null && 'resolveGapPx' in ref;
	}

	/**
	 * Tab 按钮点击处理
	 * 职责：仅控制动画跳转，不负责 store 创建（由 snippet 自动处理）
	 *
	 * @param targetIndex - 目标分类索引
	 */
	function handleCategoryChange(targetIndex: number): void {
		const targetValue = CATEGORY_OPTIONS[targetIndex]?.value;
		// 使用单例路由状态中的 currentCategoryId 判断，避免动画中途重复跳转。
		if (targetValue === homeFeedRouteState.state.currentCategoryId) {
			feedRefs[homeFeedRouteState.state.currentCategoryId]?.scrollToTopAndRefresh();
			return;
		}
		swipeablePaneRef?.jumpToIndex(targetIndex);
	}

	/**
	 * SwipeablePane 动画完成后的索引更新回调
	 * 职责：更新 categoryIndex（驱动面板虚拟窗口切换）+ currentCategoryId（兜底）
	 *
	 * store 创建由两个来源自然驱动：
	 * 1. snippet 中的 getOrCreateStore(category.value) —— 面板渲染时自动创建
	 * 2. $effect 中的骨架屏检测 —— 新分类首次加载时触发 refresh
	 *
	 * @param newIndex - 新的分类索引
	 */
	function onPaneIndexChange(newIndex: number): void {
		homeFeedRouteState.state.categoryIndex = newIndex;
		homeFeedRouteState.state.currentCategoryId = CATEGORY_OPTIONS[newIndex]?.value ?? 'general';
	}

	// ─── 生命周期 ───────────────────────────────────────────────────
	const handleHomeRefresh = () => {
		feedRefs[homeFeedRouteState.state.currentCategoryId]?.scrollToTopAndRefresh();
	};

	onMount(() => {
		// feedServiceListFeedCategories()
		// 	.then((res) => {
		// 		navigator.serviceWorker?.controller?.postMessage({
		// 			type: 'GET_MEDIA_CACHE_CATEGORIES',
		// 			data: {
		// 				mediaCategories: res.data?.categories?.map((category) => category.categoryId) || []
		// 			}
		// 		});
		// 	})
		// 	.catch((e) => {
		// 		console.error('获取 feed 流内容分类失败：', e);
		// 	});

		appBus.on('home:refresh', handleHomeRefresh);
	});

	onDestroy(() => {
		appBus.off('home:refresh', handleHomeRefresh);
		for (const store of feedStores.values()) {
			store.destroy();
		}
	});

	/**
	 * 骨架屏阶段自动触发首次数据加载
	 */
	$effect(() => {
		const categoryId = homeFeedRouteState.state.currentCategoryId;
		const store = feedStores.get(categoryId);
		if (!store) return;

		if (store.phase === 'skeleton') {
			const helper = () => {
				// 如果内容容器宽高已经测量好了，则进行刷新操作；如果没有，等待下一帧
				if (contentAreaEl && contentAreaEl.clientWidth > 0 && contentAreaEl.clientHeight > 0) {
					if (feedRefs[categoryId]) {
						feedRefs[categoryId].scrollToTopAndRefresh();
					} else {
						store.refresh();
					}
				} else {
					requestAnimationFrame(helper);
				}
			};
			helper();
		}
	});
</script>

<div class="flex h-full w-full flex-col">
	<!-- 顶部 Tab 切换 -->
	<div class="flex w-full shrink-0 items-center bg-background px-1 sm:px-2 md:px-4 lg:px-6">
		<div class="flex items-center space-x-2 overflow-x-scroll pt-1 pb-3">
			{#each CATEGORY_OPTIONS as option, index (option.value)}
				<Button
					variant="ghost"
					class={cn(
						option.value === homeFeedRouteState.state.currentCategoryId
							? 'bg-zinc-100 font-semibold dark:bg-zinc-900'
							: 'font-normal text-zinc-500 dark:text-zinc-400'
					)}
					size="default"
					onclick={() => handleCategoryChange(index)}
				>
					{option.label}
				</Button>
			{/each}
		</div>
	</div>

	<!-- 内容区域 -->
	<div
		class="flex-1 overflow-hidden"
		bind:this={contentAreaEl}
		bind:clientWidth={contentAreaWidth}
		bind:clientHeight={contentAreaHeight}
	>
		<SwipeablePane
			bind:this={swipeablePaneRef}
			categories={CATEGORY_OPTIONS}
			currentIndex={homeFeedRouteState.state.categoryIndex}
			currentCategoryId={homeFeedRouteState.state.currentCategoryId}
			onIndexChange={onPaneIndexChange}
		>
			{#snippet children(category)}
				<!--
					维度守卫：contentAreaWidth/contentAreaHeight 均为 0 时（首帧 DOM 尚未测量）
					不渲染任何内容，防止 getOrCreateStore 以 0 作为入参计算出错误的 needNum。
					bind:clientWidth/clientHeight 在首次 paint 后即更新，延迟极短，无感知。
				-->
				{#if contentAreaWidth > 0 && contentAreaHeight > 0}
					{@const store = getOrCreateStore(category.value, contentAreaWidth, contentAreaHeight)}
					{#if category.contentType === 'list'}
						<FeedList
							bind:this={feedRefs[category.value]}
							items={store.items}
							businessId={BusinessIds.FEED}
							categoryId={category.value}
							hasMore={store.hasMore}
							showSkeleton={store.showSkeleton}
							loading={store.loadingMore}
							refreshing={store.refreshing}
							onLoadMore={store.loadMore}
							onRefresh={store.refresh}
						/>
					{:else}
						<WaterfallContainer
							bind:this={feedRefs[category.value]}
							posts={store.items}
							businessId={BusinessIds.FEED}
							categoryId={category.value}
							hasMore={store.hasMore}
							showSkeleton={store.showSkeleton}
							loading={store.loadingMore}
							refreshing={store.refreshing}
							onLoadMore={store.loadMore}
							onRefresh={store.refresh}
						/>
					{/if}
				{/if}
			{/snippet}
		</SwipeablePane>
	</div>

	<!-- 悬浮刷新按钮 -->
	<Button
		size="icon"
		class="absolute right-4 bottom-8 z-50 hidden h-12 w-12 rounded-md shadow-lg md:flex"
		onclick={() => feedRefs[homeFeedRouteState.state.currentCategoryId]?.scrollToTopAndRefresh()}
	>
		<LucideRefreshCw class="h-6 w-6" />
	</Button>
</div>
