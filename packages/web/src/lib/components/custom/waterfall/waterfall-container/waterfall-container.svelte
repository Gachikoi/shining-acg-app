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
	let skeletonPositions: CardPosition[] = [];
	let lastUsedColumnIndex = 0;
	let lastCalculatedPostCount = 0;

	let pullRefreshDistance = 0;
	let isPulling = false;
	let startY = 0;
	let currentY = 0;
	let lastTouchY = 0;
	let touchMoveFrameId: number | null = null;
	let scrollFrameId: number | null = null;

	const PULL_REFRESH_CONFIG = {
		MAX_DISTANCE: 120,
		TRIGGER_THRESHOLD: 80,
		TRIGGERED_DISTANCE: 60,
		DAMPING_FACTOR: 0.5
	} as const;

	const DEFAULT_CONFIG: Partial<WaterfallConfig> = {
		minCardWidth: 280,
		gap: 16,
		bufferSize: 3,
		bufferHeight: 400,
		loadingThreshold: 200,
		cardContentHeight: 120,
		skeletonCardCount: 20,
		binarySearchThreshold: 100
	};

	$: mergedConfig = { ...DEFAULT_CONFIG, ...config };

	function calculateLayoutBase(width: number): { columnCount: number; cardWidth: number } {
		const columnCount = Math.max(1, Math.floor(width / mergedConfig.minCardWidth));
		const cardWidth = (width - (columnCount - 1) * mergedConfig.gap) / columnCount;
		return { columnCount, cardWidth };
	}

	function findMinColumnIndex(columnHeights: number[]): number {
		let minHeight = columnHeights[0];
		let minIndex = 0;
		for (let i = 1; i < columnHeights.length; i++) {
			if (columnHeights[i] < minHeight) {
				minHeight = columnHeights[i];
				minIndex = i;
			}
		}
		return minIndex;
	}

	function findMinColumnIndexWithRoundRobin(columnHeights: number[]): number {
		let minHeight = columnHeights[0];
		let minIndex = 0;
		const minIndices: number[] = [0];

		for (let i = 1; i < columnHeights.length; i++) {
			if (columnHeights[i] < minHeight) {
				minHeight = columnHeights[i];
				minIndex = i;
				minIndices.length = 0;
				minIndices.push(i);
			} else if (columnHeights[i] === minHeight) {
				minIndices.push(i);
			}
		}

		if (minIndices.length === 1) return minIndex;

		const roundRobinIndex = (lastUsedColumnIndex + 1) % minIndices.length;
		lastUsedColumnIndex = roundRobinIndex;
		return minIndices[roundRobinIndex];
	}

	function calculatePositions(
		count: number,
		getAspectRatio: (index: number) => number,
		useRoundRobin: boolean,
		targetPositions: CardPosition[],
		targetColumnHeights: number[]
	): number {
		if (containerWidth === 0 || count === 0) return 0;

		const layout = calculateLayoutBase(containerWidth);

		if (layout.columnCount !== columnCount || layout.cardWidth !== cardWidth) {
			columnCount = layout.columnCount;
			cardWidth = layout.cardWidth;
			targetColumnHeights.length = 0;
			targetColumnHeights.push(...Array(columnCount).fill(0));
			if (useRoundRobin) {
				lastUsedColumnIndex = 0;
			}
		}

		targetPositions.length = 0;
		let maxHeight = 0;

		const findMinIndex = useRoundRobin ? findMinColumnIndexWithRoundRobin : findMinColumnIndex;

		for (let i = 0; i < count; i++) {
			const coverRatio = getAspectRatio(i);

			if (!isFinite(coverRatio) || coverRatio <= 0) continue;

			const coverHeight = cardWidth * coverRatio;
			const cardHeight = coverHeight + mergedConfig.cardContentHeight;

			const minIndex = findMinIndex(targetColumnHeights);

			const left = minIndex * (cardWidth + mergedConfig.gap);
			const top = targetColumnHeights[minIndex];

			let pos = targetPositions[i];
			if (pos) {
				pos.top = top;
				pos.left = left;
				pos.width = cardWidth;
				pos.height = cardHeight;
			} else {
				targetPositions.push({ top, left, width: cardWidth, height: cardHeight });
			}

			targetColumnHeights[minIndex] = top + cardHeight + mergedConfig.gap;
			maxHeight = Math.max(maxHeight, targetColumnHeights[minIndex]);
		}

		return maxHeight;
	}

	function calculateCardPositionsIncremental(): void {
		const currentPostCount = postsRef.length;

		if (currentPostCount < lastCalculatedPostCount) {
			resetCardPositions();
		}

		if (currentPostCount <= lastCalculatedPostCount) {
			return;
		}

		if (containerWidth === 0 || currentPostCount === 0) return;

		const layout = calculateLayoutBase(containerWidth);

		if (layout.columnCount !== columnCount || layout.cardWidth !== cardWidth) {
			columnCount = layout.columnCount;
			cardWidth = layout.cardWidth;
			columnHeights.length = 0;
			columnHeights.push(...Array(columnCount).fill(0));
			lastUsedColumnIndex = 0;
			lastCalculatedPostCount = 0;
			cardPositions.length = 0;
		}

		let maxHeight = 0;
		const findMinIndex = findMinColumnIndexWithRoundRobin;

		for (let i = lastCalculatedPostCount; i < currentPostCount; i++) {
			const post = postsRef[i];
			let coverRatio = 1;

			if (
				post.cover?.single?.meta?.width &&
				post.cover.single.meta.height &&
				typeof post.cover.single.meta.width === 'number' &&
				typeof post.cover.single.meta.height === 'number' &&
				post.cover.single.meta.width > 0 &&
				post.cover.single.meta.height > 0
			) {
				const ratio = post.cover.single.meta.height / post.cover.single.meta.width;
				if (isFinite(ratio) && ratio > 0) {
					coverRatio = ratio;
				}
			}

			const coverHeight = cardWidth * coverRatio;
			const cardHeight = coverHeight + mergedConfig.cardContentHeight;

			const minIndex = findMinIndex(columnHeights);

			const left = minIndex * (cardWidth + mergedConfig.gap);
			const top = columnHeights[minIndex];

			let pos = cardPositions[i];
			if (pos) {
				pos.top = top;
				pos.left = left;
				pos.width = cardWidth;
				pos.height = cardHeight;
			} else {
				cardPositions.push({ top, left, width: cardWidth, height: cardHeight });
			}

			columnHeights[minIndex] = top + cardHeight + mergedConfig.gap;
			maxHeight = Math.max(maxHeight, columnHeights[minIndex]);
		}

		lastCalculatedPostCount = currentPostCount;

		if (scrollContainer) {
			scrollContainer.style.height = `${maxHeight}px`;
		}
	}

	function resetCardPositions(): void {
		cardPositions.length = 0;
		columnHeights.length = 0;
		lastCalculatedPostCount = 0;
		lastUsedColumnIndex = 0;
	}

	function calculateSkeletonPositions(): void {
		const skeletonColumnHeights: number[] = [];
		const maxHeight = calculatePositions(
			skeletonCount,
			(index) => {
				const ratios = [0.75, 1, 1.33, 1.5, 0.8, 1.25];
				return ratios[index % ratios.length];
			},
			false,
			skeletonPositions,
			skeletonColumnHeights
		);

		if (scrollContainer) {
			scrollContainer.style.height = `${maxHeight}px`;
		}
	}

	function updateVisibleRange(): void {
		if (!scrollContainer || !containerElement) return;

		const scrollTop = scrollContainer.scrollTop;
		const containerHeight = containerElement.clientHeight;
		const visibleBuffer = mergedConfig.bufferSize * mergedConfig.bufferHeight;

		const startBuffer = Math.max(0, scrollTop - visibleBuffer);
		const endBuffer = scrollTop + containerHeight + visibleBuffer;

		let start = cardPositions.length;
		let end = 0;

		if (cardPositions.length > mergedConfig.binarySearchThreshold) {
			start = findVisibleRangeStart(startBuffer);
			end = findVisibleRangeEnd(endBuffer);
		} else {
			for (let i = 0; i < cardPositions.length; i++) {
				const pos = cardPositions[i];
				if (pos.top + pos.height >= startBuffer && pos.top <= endBuffer) {
					start = Math.min(start, i);
					end = Math.max(end, i);
				}
			}
		}

		if (start === cardPositions.length) start = 0;
		if (end < start) end = start;
		visibleRange = { start, end };
	}

	function findVisibleRangeStart(target: number): number {
		let left = 0;
		let right = cardPositions.length - 1;
		let result = cardPositions.length;

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const pos = cardPositions[mid];

			if (pos.top + pos.height >= target) {
				result = mid;
				right = mid - 1;
			} else {
				left = mid + 1;
			}
		}

		return result;
	}

	function findVisibleRangeEnd(target: number): number {
		let left = 0;
		let right = cardPositions.length - 1;
		let result = 0;

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const pos = cardPositions[mid];

			if (pos.top <= target) {
				result = mid;
				left = mid + 1;
			} else {
				right = mid - 1;
			}
		}

		return result;
	}

	function handleScroll(): void {
		if (scrollFrameId !== null) return;

		scrollFrameId = requestAnimationFrame(() => {
			updateVisibleRange();

			if (!scrollContainer) {
				scrollFrameId = null;
				return;
			}

			const scrollTop = scrollContainer.scrollTop;
			const scrollHeight = scrollContainer.scrollHeight;
			const clientHeight = scrollContainer.clientHeight;

			if (
				scrollHeight - scrollTop - clientHeight < mergedConfig.loadingThreshold &&
				data.hasMore &&
				!data.loading
			) {
				data.loadMore().catch((error) => {
					console.error('Failed to load more posts:', error);
				});
			}

			scrollFrameId = null;
		});
	}

	async function handleRefresh(): Promise<void> {
		if (data.refreshing) return;
		try {
			await data.refresh();
		} catch (error) {
			console.error('Failed to refresh posts:', error);
			pullRefreshDistance = 0;
		}
	}

	function handleTouchStart(event: TouchEvent): void {
		if (scrollContainer.scrollTop > 1) return;
		startY = event.touches[0].clientY;
		lastTouchY = startY;
		isPulling = true;
	}

	function handleTouchMove(event: TouchEvent): void {
		if (!isPulling) return;

		if (scrollContainer.scrollTop > 0) {
			resetPullRefresh();
			return;
		}

		const touchY = event.touches[0].clientY;
		const deltaY = touchY - lastTouchY;
		lastTouchY = touchY;

		if (deltaY <= 0) {
			resetPullRefresh();
			return;
		}

		if (touchMoveFrameId !== null) {
			return;
		}

		touchMoveFrameId = requestAnimationFrame(() => {
			currentY = touchY;
			const distance = currentY - startY;

			if (distance > 0) {
				pullRefreshDistance = Math.min(
					distance * PULL_REFRESH_CONFIG.DAMPING_FACTOR,
					PULL_REFRESH_CONFIG.MAX_DISTANCE
				);
			}

			touchMoveFrameId = null;
		});
	}

	function handleTouchEnd(): void {
		if (!isPulling) return;

		isPulling = false;

		if (pullRefreshDistance >= PULL_REFRESH_CONFIG.TRIGGER_THRESHOLD) {
			pullRefreshDistance = PULL_REFRESH_CONFIG.TRIGGERED_DISTANCE;
			handleRefresh();
		} else {
			pullRefreshDistance = 0;
		}
	}

	function handleTouchCancel(): void {
		resetPullRefresh();
	}

	function resetPullRefresh(): void {
		isPulling = false;
		pullRefreshDistance = 0;
		if (touchMoveFrameId !== null) {
			cancelAnimationFrame(touchMoveFrameId);
			touchMoveFrameId = null;
		}
	}

	function cleanup(): void {
		if (touchMoveFrameId !== null) {
			cancelAnimationFrame(touchMoveFrameId);
			touchMoveFrameId = null;
		}
		if (scrollFrameId !== null) {
			cancelAnimationFrame(scrollFrameId);
			scrollFrameId = null;
		}
	}

	onMount(() => {
		if (!containerElement) return;

		scrollContainer = containerElement;

		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const newWidth = entry.contentRect.width;
				if (newWidth !== containerWidth) {
					containerWidth = newWidth;
					resetCardPositions();
					calculateCardPositionsIncremental();
					updateVisibleRange();
				}
			}
		});

		resizeObserver.observe(containerElement);

		if (data.loading && data.posts.length === 0) {
			skeletonCount = mergedConfig.skeletonCardCount;
		}

		scrollContainer.addEventListener('scroll', handleScroll);
		scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
		scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
		scrollContainer.addEventListener('touchend', handleTouchEnd);
		scrollContainer.addEventListener('touchcancel', handleTouchCancel);

		tick().then(() => {
			if (containerElement) {
				containerWidth = containerElement.clientWidth;
				resetCardPositions();
				calculateCardPositionsIncremental();
				calculateSkeletonPositions();
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
			scrollContainer.removeEventListener('touchcancel', handleTouchCancel);
		}
		cleanup();
	});

	$: postsRef = data.posts;
	$: loadingRef = data.loading;

	$: if (postsRef.length > 0) {
		calculateCardPositionsIncremental();
		updateVisibleRange();
	}

	$: if (loadingRef && postsRef.length === 0) {
		skeletonCount = mergedConfig.skeletonCardCount;
		calculateSkeletonPositions();
	} else if (!loadingRef) {
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
				{:else if pullRefreshDistance >= PULL_REFRESH_CONFIG.TRIGGER_THRESHOLD}
					<span class="text-sm text-muted-foreground">释放刷新</span>
				{:else}
					<span class="text-sm text-muted-foreground">下拉刷新</span>
				{/if}
			</div>
		{/if}

		{#if skeletonCount > 0}
			{#each skeletonPositions as pos, i (i)}
				<div class="absolute" style="top: {pos.top}px; left: {pos.left}px; width: {pos.width}px;">
					<WaterfallSkeletonCard
						aspectRatio={(pos.height - mergedConfig.cardContentHeight) / pos.width}
					/>
				</div>
			{/each}
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
