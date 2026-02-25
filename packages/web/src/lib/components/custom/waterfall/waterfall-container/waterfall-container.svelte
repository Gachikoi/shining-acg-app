<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { WaterfallCard } from '../waterfall-cards';
	import { WaterfallSkeletonCard } from '../waterfall-cards';
	import type { WaterfallData, WaterfallConfig, CardPosition } from './types';

	export let data: WaterfallData;
	export let config: WaterfallConfig;

	let containerElement: HTMLElement;
	let resizeObserver: ResizeObserver;
	let scrollContainer: HTMLElement;

	let containerWidth = 0;
	let columnCount = 1;
	let cardWidth = 0;
	let columnHeights: number[] = [];
	let cardPositions: CardPosition[] = [];
	let visibleRange = { start: 0, end: 0 };
	let skeletonCount = 0;

	let pullRefreshDistance = 0;
	let isPulling = false;
	let startY = 0;
	let currentY = 0;

	const DEFAULT_CONFIG: Partial<WaterfallConfig> = {
		minCardWidth: 280,
		gap: 16,
		bufferSize: 3,
		loadingThreshold: 200,
		needNum: 20
	};

	$: mergedConfig = { ...DEFAULT_CONFIG, ...config };

	function calculateColumnCount(width: number): number {
		return Math.max(1, Math.floor(width / mergedConfig.minCardWidth));
	}

	function calculateCardWidth(width: number, columns: number): number {
		return (width - (columns - 1) * mergedConfig.gap) / columns;
	}

	function calculateCardPositions(): void {
		if (containerWidth === 0) return;

		const newColumnCount = calculateColumnCount(containerWidth);
		const newCardWidth = calculateCardWidth(containerWidth, newColumnCount);

		if (newColumnCount !== columnCount || newCardWidth !== cardWidth) {
			columnCount = newColumnCount;
			cardWidth = newCardWidth;
			columnHeights = Array(columnCount).fill(0);
		}

		cardPositions = [];
		let maxHeight = 0;

		for (let i = 0; i < data.posts.length; i++) {
			const post = data.posts[i];
			const coverRatio =
				post.cover?.single?.meta?.width && post.cover.single.meta.height
					? post.cover.single.meta.height / post.cover.single.meta.width
					: 1;

			const coverHeight = cardWidth * coverRatio;
			const cardHeight = coverHeight + 120;

			const minHeight = Math.min(...columnHeights);
			const minIndex = columnHeights.indexOf(minHeight);

			const left = minIndex * (cardWidth + mergedConfig.gap);
			const top = minHeight;

			cardPositions.push({ top, left, width: cardWidth, height: cardHeight });

			columnHeights[minIndex] = minHeight + cardHeight + mergedConfig.gap;
			maxHeight = Math.max(maxHeight, columnHeights[minIndex]);
		}

		if (scrollContainer) {
			scrollContainer.style.height = `${maxHeight}px`;
		}
	}

	function updateVisibleRange(): void {
		if (!scrollContainer || !containerElement) return;

		const scrollTop = scrollContainer.scrollTop;
		const containerHeight = containerElement.clientHeight;
		const bufferHeight = mergedConfig.bufferSize * 400;

		const startBuffer = Math.max(0, scrollTop - bufferHeight);
		const endBuffer = scrollTop + containerHeight + bufferHeight;

		let start = 0;
		let end = 0;

		for (let i = 0; i < cardPositions.length; i++) {
			const pos = cardPositions[i];
			if (pos.top + pos.height >= startBuffer && pos.top <= endBuffer) {
				if (start === 0) start = i;
				end = i;
			}
		}

		if (end < start) end = start;
		visibleRange = { start, end };
	}

	function handleScroll(): void {
		updateVisibleRange();

		if (!scrollContainer) return;

		const scrollTop = scrollContainer.scrollTop;
		const scrollHeight = scrollContainer.scrollHeight;
		const clientHeight = scrollContainer.clientHeight;

		if (
			scrollHeight - scrollTop - clientHeight < mergedConfig.loadingThreshold &&
			data.hasMore &&
			!data.loading
		) {
			data.loadMore();
		}
	}

	async function handleRefresh(): Promise<void> {
		if (data.refreshing) return;
		await data.refresh();
	}

	function handleTouchStart(event: TouchEvent): void {
		if (scrollContainer.scrollTop > 0) return;
		startY = event.touches[0].clientY;
		isPulling = true;
	}

	function handleTouchMove(event: TouchEvent): void {
		if (!isPulling || scrollContainer.scrollTop > 0) return;

		currentY = event.touches[0].clientY;
		const distance = currentY - startY;

		if (distance > 0) {
			pullRefreshDistance = Math.min(distance * 0.5, 120);
		}
	}

	async function handleTouchEnd(): Promise<void> {
		if (!isPulling) return;

		isPulling = false;

		if (pullRefreshDistance >= 80) {
			pullRefreshDistance = 60;
			await handleRefresh();
		}

		pullRefreshDistance = 0;
	}

	onMount(() => {
		if (!containerElement) return;

		scrollContainer = containerElement;

		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const newWidth = entry.contentRect.width;
				if (newWidth !== containerWidth) {
					containerWidth = newWidth;
					calculateCardPositions();
					updateVisibleRange();
				}
			}
		});

		resizeObserver.observe(containerElement);

		if (data.loading && data.posts.length === 0) {
			skeletonCount = mergedConfig.needNum;
		}

		scrollContainer.addEventListener('scroll', handleScroll);
		scrollContainer.addEventListener('touchstart', handleTouchStart);
		scrollContainer.addEventListener('touchmove', handleTouchMove);
		scrollContainer.addEventListener('touchend', handleTouchEnd);

		tick().then(() => {
			if (containerElement) {
				containerWidth = containerElement.clientWidth;
				calculateCardPositions();
				updateVisibleRange();
			}
		});
	});

	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (scrollContainer) {
			scrollContainer.removeEventListener('scroll', handleScroll);
			scrollContainer.removeEventListener('touchstart', handleTouchStart);
			scrollContainer.removeEventListener('touchmove', handleTouchMove);
			scrollContainer.removeEventListener('touchend', handleTouchEnd);
		}
	});

	$: if (data.posts.length > 0) {
		calculateCardPositions();
		updateVisibleRange();
	}

	$: if (data.loading && data.posts.length === 0) {
		skeletonCount = mergedConfig.needNum;
	} else if (!data.loading) {
		skeletonCount = 0;
	}
</script>

<div class="relative h-full w-full overflow-y-auto" bind:this={containerElement}>
	<div class="relative w-full">
		{#if pullRefreshDistance > 0}
			<div
				class="flex items-center justify-center transition-all duration-200"
				style="height: {pullRefreshDistance}px;"
			>
				{#if data.refreshing}
					<div class="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
				{:else if pullRefreshDistance >= 80}
					<span class="text-sm text-muted-foreground">释放刷新</span>
				{:else}
					<span class="text-sm text-muted-foreground">下拉刷新</span>
				{/if}
			</div>
		{/if}

		{#if skeletonCount > 0}
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
				{#each Array(skeletonCount) as i (i)}
					<WaterfallSkeletonCard />
				{/each}
			</div>
		{:else}
			{#each data.posts as post, i (i)}
				{#if i >= visibleRange.start && i <= visibleRange.end}
					<div
						class="absolute"
						style="top: {cardPositions[i]?.top}px; left: {cardPositions[i]
							?.left}px; width: {cardPositions[i]?.width}px;"
					>
						<WaterfallCard
							postId={post.post_id || ''}
							title={post.display_title || ''}
							cover={{
								url: post.cover?.single?.url || '',
								ratio:
									post.cover?.single?.meta?.width && post.cover.single.meta.height
										? post.cover.single.meta.height / post.cover.single.meta.width
										: 1
							}}
							author={{
								avatar: post.author?.avatar || '',
								name: post.author?.name || '',
								id: post.author?.user_id || ''
							}}
							likeCount={post.stats?.like_count || 0}
							viewCount={post.stats?.view_count || 0}
							commentCount={post.stats?.comment_count || 0}
							isLiked={post.relation_status?.is_liked || false}
							isOnlyVideo={post.is_only_video || false}
							publishTime={parseInt(post.publish_time || '0')}
						/>
					</div>
				{/if}
			{/each}
		{/if}

		{#if data.loading && data.posts.length > 0}
			<div class="flex justify-center py-4">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
			</div>
		{/if}

		{#if !data.hasMore && data.posts.length > 0}
			<div class="py-4 text-center text-sm text-muted-foreground">没有更多内容了</div>
		{/if}
	</div>
</div>
