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
	import { WaterfallContainer } from '$lib/components/custom/waterfall';
	import { FeedList } from '$lib/components/custom/feed-list';
	import { SwipeablePane, type CategoryOption } from '$lib/components/custom/swipeable-pane';
	import { Button } from '$lib/components/ui/button';
	import { appBus } from '$lib/events/app-bus';
	import { createDbCache } from '$lib/modules/cache';
	import {
		createFeedStore,
		type FeedStore,
		POST_CACHE_ADAPTER,
		USER_CACHE_ADAPTER,
		createPostFetchFn,
		createUserFetchFn,
		getPostId,
		getUserId,
		generatePostSkeletons,
		generateUserSkeletons
	} from '$lib/stores/feed';
	import { appState } from '$lib/stores/app-state.svelte';
	import { LucideRefreshCw } from 'lucide-svelte';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	import type {
		V1FeedFilter,
		V1FeedOrderType,
		V1GetFeedResponse,
		V1PostPreview,
		V1TimeRange,
		V1UserSummary
	} from '$lib/api/types.gen';
	import { estimateNeedNum } from '$lib/modules/virtual-feed';
	import { breakpoint, remToPx } from '$lib/modules/device';
	import { feedServiceListFeedCategories } from '$lib/api';
	import { cn } from '$lib/utils';

	// ─── 缓存 ──────────────────────────────────────────────────────

	const feedCache = createDbCache<V1GetFeedResponse>('feed', { defaultTtl: 5 * 60 * 1000 });

	// ─── 分类配置 ──────────────────────────────────────────────────

	const CATEGORY_OPTIONS: CategoryOption[] = [
		{ label: '综合', value: 'general', contentType: 'waterfall' },
		{ label: '关注', value: 'following', contentType: 'waterfall' },
		{ label: '用户', value: 'user', contentType: 'list' },
		{ label: '1', value: 'shining', contentType: 'waterfall' },
		{ label: '2', value: 'search', contentType: 'waterfall' },
		{ label: '3', value: 'message', contentType: 'waterfall' },
		{ label: '4', value: 'profile', contentType: 'waterfall' },
		{ label: '5', value: 'setting', contentType: 'waterfall' }
	];

	/** 内容区容器 DOM 引用 */
	let contentAreaEl: HTMLElement | undefined = $state();

	// ─── 分类状态 ──────────────────────────────────────────────────

	let categoryIndex = $state(0);
	let currentCategoryId = $derived(CATEGORY_OPTIONS[categoryIndex]?.value ?? 'general');

	// ─── 筛选状态（页面级，跨分类共享） ──────────────────────────────

	let keyword = $derived(appState.searchKeyword);
	let orderType = $state<V1FeedOrderType>('FEED_ORDER_TYPE_RECOMMENDED');
	let timeRange = $state<V1TimeRange>({});
	let authorId = $state<string | undefined>(undefined);

	/** 筛选上下文 getter——注入到 feed-api 的 fetch 工厂中 */
	function getFilters(): V1FeedFilter {
		return { keyword, orderType, timeRange, authorId };
	}

	// ─── FeedStore 管理 ─────────────────────────────────────────────

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const feedStores = new Map<string, FeedStore<any>>();

	/**
	 * 获取或创建指定分类的 FeedStore
	 *
	 * @param categoryId - 分类 ID
	 * @returns FeedStore 实例
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function getOrCreateStore(categoryId: string): FeedStore<any> {
		let store = feedStores.get(categoryId);
		if (store) return store;

		const contentType =
			CATEGORY_OPTIONS.find((c) => c.value === categoryId)?.contentType ?? 'waterfall';
		const onError = (_error: unknown, context: 'init' | 'refresh' | 'loadMore') => {
			if (context === 'refresh') toast.error('网络请求失败，请检查您的网络连接');
		};

		if (contentType === 'list') {
			store = createFeedStore<V1UserSummary>(categoryId, {
				needNum: estimateNeedNum('list', {
					containerWidth: contentAreaEl?.clientWidth ?? 0,
					containerHeight: contentAreaEl?.clientHeight ?? 0,
					minCardWidth: contentAreaEl?.clientWidth ?? 0,
					avgCardRatio: remToPx(13) / (contentAreaEl?.clientWidth ?? 0) // 用户列表项的高度通常为 100
				}),
				cache: feedCache,
				cacheAdapter: USER_CACHE_ADAPTER,
				getItemId: getUserId,
				generateSkeleton: generateUserSkeletons,
				fetchFn: createUserFetchFn(getFilters),
				onError
			});
		} else {
			store = createFeedStore<V1PostPreview>(categoryId, {
				needNum: estimateNeedNum('waterfall', {
					containerWidth: contentAreaEl?.clientWidth ?? 0,
					containerHeight: contentAreaEl?.clientHeight ?? 0,
					gap: breakpoint.isLg ? remToPx(1.5) : breakpoint.isMd ? remToPx(16) : remToPx(8)
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
	let waterfallRefs = $state<Record<string, ReturnType<typeof WaterfallContainer> | undefined>>({});

	function handleCategoryChange(targetIndex: number): void {
		if (targetIndex === categoryIndex) {
			waterfallRefs[currentCategoryId]?.scrollToTopAndRefresh();
			return;
		}
		const targetCategory = CATEGORY_OPTIONS[targetIndex];
		getOrCreateStore(targetCategory.value);
		swipeablePaneRef?.jumpToIndex(targetIndex);
	}

	function onPaneIndexChange(newIndex: number): void {
		categoryIndex = newIndex;
		const category = CATEGORY_OPTIONS[newIndex];
		getOrCreateStore(category.value);

		if (newIndex > 0) getOrCreateStore(CATEGORY_OPTIONS[newIndex - 1].value);
		if (newIndex < CATEGORY_OPTIONS.length - 1)
			getOrCreateStore(CATEGORY_OPTIONS[newIndex + 1].value);
	}

	// ─── 生命周期 ───────────────────────────────────────────────────
	const handleHomeRefresh = () => {
		waterfallRefs[currentCategoryId]?.scrollToTopAndRefresh();
	};

	onMount(() => {
		// 获取内容分类目录后，发送给 sw，以创建后续的 cacheName
		feedServiceListFeedCategories()
			.then((res) => {
				navigator.serviceWorker?.controller?.postMessage({
					type: 'GET_MEDIA_CACHE_CATEGORIES',
					data: {
						mediaCategories: res.data?.categories?.map((category) => category.categoryId) || []
					}
				});
			})
			.catch((e) => {
				console.error('获取 feed 流内容分类失败：', e);
			});

		getOrCreateStore(currentCategoryId);
		appBus.on('home:refresh', handleHomeRefresh);
	});

	onDestroy(() => {
		appBus.off('home:refresh', handleHomeRefresh);
		for (const store of feedStores.values()) {
			store.destroy();
		}
		feedStores.clear();
	});

	$effect(() => {
		const store = getOrCreateStore(currentCategoryId);
		// 如果当前分类的 store 处于 skeleton 阶段，则刷新瀑布流
		// 在这里刷新可以获得“下拉效果”
		if (store.phase === 'skeleton') {
			if (waterfallRefs[currentCategoryId]) {
				waterfallRefs[currentCategoryId].scrollToTopAndRefresh();
			} else {
				// TODO 兼容目前的 feed-list 实现
				store.refresh();
			}
		}
	});
</script>

<div class="flex h-full w-full flex-col">
	<!-- 顶部 Tab 切换 -->
	<div class="flex w-full shrink-0 items-center bg-background px-4 py-2">
		<div class="flex space-x-2">
			{#each CATEGORY_OPTIONS as option, index (option.value)}
				<Button
					variant="ghost"
					class={cn(
						categoryIndex === index
							? 'bg-zinc-100 dark:bg-zinc-900'
							: 'text-zinc-500 dark:text-zinc-400'
					)}
					size="sm"
					onclick={() => handleCategoryChange(index)}
				>
					{option.label}
				</Button>
			{/each}
		</div>
	</div>

	<!-- 内容区域 -->
	<div class="flex-1 overflow-hidden" bind:this={contentAreaEl}>
		<SwipeablePane
			bind:this={swipeablePaneRef}
			categories={CATEGORY_OPTIONS}
			currentIndex={categoryIndex}
			onIndexChange={onPaneIndexChange}
		>
			{#snippet children(category)}
				{@const store = getOrCreateStore(category.value)}
				{#if category.contentType === 'list'}
					<FeedList
						items={store.items}
						loading={store.loadingMore}
						hasMore={store.hasMore}
						showSkeleton={store.showSkeleton}
						onLoadMore={() => store.loadMore()}
					/>
				{:else}
					<WaterfallContainer
						bind:this={waterfallRefs[category.value]}
						posts={store.items}
						loading={store.loadingMore}
						hasMore={store.hasMore}
						showSkeleton={store.showSkeleton}
						refreshing={store.refreshing}
						categoryId={category.value}
						onLoadMore={store.loadMore}
						onRefresh={store.refresh}
					/>
				{/if}
			{/snippet}
		</SwipeablePane>
	</div>

	<!-- 悬浮刷新按钮 -->
	<Button
		size="icon"
		class="absolute right-4 bottom-8 z-50 hidden h-12 w-12 rounded-md shadow-lg md:flex"
		onclick={() => {
			waterfallRefs[currentCategoryId]?.scrollToTopAndRefresh();
		}}
	>
		<LucideRefreshCw class="h-6 w-6" />
	</Button>
</div>
