<script lang="ts">
	import type { V1GetFeedResponse, V1PostPreview } from '$lib/api';
	import WaterfallContainer from '$lib/components/custom/waterfall/waterfall-container/waterfall-container.svelte';
	import { BusinessIds } from '$lib/constants';
	import { createDbCache } from '$lib/modules/cache';
	import {
		createFeedStore,
		createPostFetchFn,
		estimateNeedNum,
		generatePostSkeletons,
		POST_CACHE_ADAPTER,
		type FeedStore
	} from '$lib/stores/feed';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const hotPostCache = createDbCache<V1GetFeedResponse>(BusinessIds.HOT_POST);

	let waterfallRef: ReturnType<typeof WaterfallContainer> | null = $state(null);
	let containerEl: HTMLElement | null = $state(null);

	let store = $state<FeedStore<V1PostPreview> | null>(null);

	onMount(() => {
		store = createFeedStore<V1PostPreview>('general', {
			needNum: estimateNeedNum('waterfall', {
				containerWidth: containerEl?.clientWidth ?? 0,
				containerHeight: containerEl?.clientHeight ?? 0,
				gap: waterfallRef?.resolveGapPx() ?? 8,
				minItemWidth: waterfallRef?.DEFAULT_CONFIG.minCardWidth ?? 280
			}),
			cache: hotPostCache,
			cacheAdapter: POST_CACHE_ADAPTER,
			getItemId: (post) => post.postId,
			generateSkeleton: generatePostSkeletons,
			fetchFn: createPostFetchFn(() => ({})),
			onError: () => {
				toast.error('Feed 内容获取失败，请检查您的网络连接');
			}
		});
		store.init();
		store.refresh();
	});
</script>

<!--
	热门动态：锚点 #post
-->
<section
	id="post"
	class="flex h-[800px] w-full shrink-0 flex-col items-center justify-center px-6 pt-20"
	aria-label="热门动态"
	bind:this={containerEl}
>
	<!-- <h2 class="font-tech text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">热门动态</h2>
	<p class="mt-4 max-w-2xl text-center text-zinc-500">App 优质内容聚合（待接入内容）。</p> -->
	{#if store}
		<WaterfallContainer
			bind:this={waterfallRef}
			posts={store.items}
			loading={store.loadingMore}
			hasMore={store.hasMore}
			showSkeleton={store.showSkeleton}
			refreshing={store.refreshing}
			businessId={BusinessIds.HOT_POST}
			categoryId={BusinessIds.HOT_POST}
			onLoadMore={store.loadMore}
			onRefresh={store.refresh}
		/>
	{/if}
</section>
