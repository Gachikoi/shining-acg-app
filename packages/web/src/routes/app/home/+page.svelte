<script lang="ts">
	import { WaterfallContainer } from '$lib/components/custom/waterfall';
	import { feedServiceGetFeed } from '$lib/api/sdk.gen';

	// 单元测试接口
	// 单元测试请求代码在 90 行
	// import { mockFetchFeed } from '$lib/test/waterfall-data-mock';

	import type { V1PostPreview } from '$lib/api/types.gen';
	import type { WaterfallData } from '$lib/components/custom/waterfall/waterfall-container/types';
	import { appState } from '$lib/stores/app-state.svelte';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { SvelteSet } from 'svelte/reactivity';
	import { LucideRefreshCw } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	// 状态管理
	let posts = $state<V1PostPreview[]>([]);
	let loading = $state(false);
	let refreshing = $state(false);
	let hasMore = $state(true);
	let cursor = $state<string | null>(null);
	let waterfallRef: ReturnType<typeof WaterfallContainer> | undefined = $state();

	// 筛选状态
	let scene = $state('general');
	let keyword = $derived(appState.searchKeyword); // 从全局状态派生
	let orderType = $state<
		'FEED_ORDER_TYPE_RECOMMENDED' | 'FEED_ORDER_TYPE_LATEST' | 'FEED_ORDER_TYPE_HOT'
	>('FEED_ORDER_TYPE_RECOMMENDED');
	let timeRange = $state<{ start?: string; end?: string }>({});
	let selectedAuthorId = $state<string | undefined>(undefined);

	// 去重 Set
	let seenIds = new SvelteSet<string>();
	let currentFetchId = 0;

	const NEED_NUM = 20;

	const SCENE_OPTIONS = [
		{ label: '推荐', value: 'general' },
		{ label: '关注', value: 'following' }
	];

	/**
	 * 获取数据核心逻辑
	 */
	async function fetchPosts(isRefresh: boolean = false) {
		// 允许刷新操作打断当前的加载或刷新
		if (!isRefresh && (loading || refreshing)) return;

		const fetchId = ++currentFetchId;

		// 设置状态
		if (isRefresh) {
			refreshing = true;
		} else {
			loading = true;
		}

		try {
			const currentCursor = isRefresh ? undefined : cursor || undefined;

			// 构建查询参数
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const queryParams: any = {
				'pagination.cursor': currentCursor,
				'pagination.need_num': NEED_NUM,
				refresh_type: isRefresh ? 'REFRESH_TYPE_PULL_DOWN' : 'REFRESH_TYPE_PULL_UP',
				category_id: scene === 'general' ? undefined : scene
			};

			// 根据场景应用不同的筛选逻辑
			if (scene === 'following') {
				// 1. ”首页-关注“只支持按照作者id筛选
				if (selectedAuthorId) {
					queryParams['filter.author_id'] = selectedAuthorId;
				}
			} else if (['self_post', 'self_like', 'self_collect'].includes(scene)) {
				// 2. 个人的帖子/收藏/点赞处只支持按照搜索框的keyword筛选
				if (keyword) {
					queryParams['filter.keyword'] = keyword;
				}
			} else {
				// 3. 其他场景支持 keyword、发布时间、排序依据筛选
				if (keyword) queryParams['filter.keyword'] = keyword;
				if (orderType) queryParams['filter.order_type'] = orderType;
				if (timeRange.start) queryParams['filter.time_range.start_timestamp'] = timeRange.start;
				if (timeRange.end) queryParams['filter.time_range.end_timestamp'] = timeRange.end;
			}

			// 单元测试 API
			// const response = await mockFetchFeed({
			// 	query: queryParams,
			// 	url: '/v1/feed'
			// });

			// 真实 API
			const response = await feedServiceGetFeed({
				query: queryParams
			});

			if (fetchId !== currentFetchId) return;

			if (response.error) {
				const error = response.error;
				console.error('Fetch feed failed:', error);
				toast.error(error.message || '获取数据失败，请稍后重试');
				return;
			}

			if (response.data) {
				// 注意：response.data.posts 是 PostFeedContent 对象，包含 items
				const newPosts = response.data.posts?.items || [];
				const newCursor = response.data.cursor || null;

				if (isRefresh) {
					// 刷新：清空旧数据
					posts = [];
					seenIds.clear();
					hasMore = true; // 重置 hasMore

					// 手动清理瀑布流组件内部状态
					if (waterfallRef) {
						waterfallRef.resetLayout();
					}
				}

				// 过滤重复数据
				const uniqueNewPosts: V1PostPreview[] = [];
				for (const post of newPosts) {
					if (post.post_id && !seenIds.has(post.post_id)) {
						seenIds.add(post.post_id);
						uniqueNewPosts.push(post);
					}
				}

				if (uniqueNewPosts.length > 0) {
					// 使用扩展运算符追加新数据
					posts = [...posts, ...uniqueNewPosts];
				}

				// 更新游标
				cursor = newCursor;

				// 判断是否还有更多数据 (模拟：如果总数超过 200 则停止)
				// 这里我们简单判断本次返回是否为空，实际 Mock 中可以设置上限
				if (newPosts.length < NEED_NUM || (cursor && parseInt(cursor) > 200)) {
					hasMore = false;
				}
			} else {
				hasMore = false;
			}
		} catch (error) {
			console.error('Failed to fetch feed:', error);
			toast.error('网络请求失败，请检查您的网络连接');
		} finally {
			// 只有当前最新的请求才负责关闭 loading/refreshing 状态
			if (fetchId === currentFetchId) {
				loading = false;
				refreshing = false;
			}
		}
	}

	/**
	 * 加载更多
	 */
	async function loadMore() {
		if (!hasMore) return;
		await fetchPosts(false);
	}

	/**
	 * 刷新
	 */
	async function refresh() {
		await fetchPosts(true);
	}

	// 构造传递给 WaterfallContainer 的数据对象
	// 通过 $derived 确保响应性，WaterfallContainer 会响应 prop 变化
	let waterfallData: WaterfallData = $derived({
		posts: posts,
		loading: loading,
		refreshing: refreshing,
		hasMore: hasMore,
		cursor: cursor,
		loadMore: loadMore,
		refresh: refresh
	});

	/**
	 * 统一刷新入口，处理依赖和去重
	 */
	function triggerRefresh() {
		// 重置状态
		seenIds.clear(); // 刷新时清空去重Set
		fetchPosts(true);
	}

	// 监听筛选条件变化，自动刷新
	$effect(() => {
		// 显式读取依赖，确保 effect 在这些状态变化时重新运行
		void scene;
		void keyword;
		void orderType;
		void timeRange.start;
		void timeRange.end;
		void selectedAuthorId;

		// 使用 untrack 包裹副作用函数，防止 fetchPosts 内部读取的状态（如 loading）导致死循环
		untrack(() => {
			triggerRefresh();
		});
	});
</script>

<div class="flex h-full w-full flex-col">
	<!-- 顶部 Tab 切换 -->
	<div class="flex w-full shrink-0 items-center border-b bg-background px-4 py-2">
		<div class="flex space-x-2">
			{#each SCENE_OPTIONS as option (option)}
				<Button
					variant={scene === option.value ? 'default' : 'ghost'}
					size="sm"
					onclick={() => {
						scene = option.value;
					}}
				>
					{option.label}
				</Button>
			{/each}
		</div>
	</div>

	<!-- 瀑布流容器 -->
	<div class="flex-1 overflow-hidden">
		<WaterfallContainer bind:this={waterfallRef} data={waterfallData} />
	</div>

	<!-- 悬浮按钮 - 仅在 md (平板/电脑) 以上屏幕显示 -->
	<Button
		size="icon"
		class="absolute right-4 bottom-8 z-50 hidden h-12 w-12 rounded-md shadow-lg md:flex"
		onclick={() => waterfallRef?.scrollToTopAndRefresh()}
	>
		<LucideRefreshCw class="h-6 w-6" />
	</Button>
</div>
