<!-- 549行空的Summary -->
<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { WaterfallCard } from '../waterfall-cards';
	import type { WaterfallData, WaterfallConfig, CardPosition } from './types';
	import type { V1PostPreview } from '$lib/api/types.gen';
	import { Spinner } from '$lib/components/ui/spinner';

	// 组件属性：接收瀑布流数据和配置
	let { data, config }: { data: WaterfallData; config?: WaterfallConfig } = $props();

	// DOM 元素引用
	let containerElement: HTMLElement; // 容器元素
	let resizeObserver: ResizeObserver; // 容器尺寸变化观察器
	let scrollContainer: HTMLElement; // 滚动容器元素

	// 布局相关状态
	let containerWidth = $state(0); // 容器宽度
	let columnCount = $state(1); // 列数
	let cardWidth = $state(0); // 卡片宽度
	let columnHeights: number[] = $state([]); // 各列高度数组
	let cardPositions: CardPosition[] = $state([]); // 卡片位置信息数组
	let visibleRange = $state({ start: 0, end: 0 }); // 可见范围（起始和结束索引）
	let maxHeight = $state(0); // 最大高度

	// 下拉刷新相关状态
	let pullRefreshDistance = $state(0); // 下拉距离
	let isPulling = $state(false); // 是否正在下拉
	let startY = $state(0); // 触摸起始Y坐标
	let currentY = $state(0); // 当前触摸Y坐标
	let touchMoveFrameId: number | null = $state(null); // 触摸移动动画帧ID
	let scrollFrameId: number | null = $state(null); // 滚动动画帧ID

	// 帖子数据引用（响应式）- 支持 store 或普通值
	let postsRef = $state<V1PostPreview[]>([]);
	let loadingRef = $state<boolean>(false);
	let refreshingRef = $state<boolean>(false);
	let hasMoreRef = $state<boolean>(true);
	let lastPostsLength = 0;

	// 追踪 store 变化并更新本地状态
	let unsubscribePosts: (() => void) | null = null;
	let unsubscribeLoading: (() => void) | null = null;
	let unsubscribeRefreshing: (() => void) | null = null;
	let unsubscribeHasMore: (() => void) | null = null;

	/* eslint-disable svelte/require-store-reactive-access */
	$effect(() => {
		if (typeof data.posts === 'object' && 'subscribe' in data.posts) {
			unsubscribePosts?.();
			unsubscribePosts = data.posts.subscribe((value) => {
				postsRef = value;
			});
		} else {
			postsRef = data.posts;
		}
		if (typeof data.loading === 'object' && 'subscribe' in data.loading) {
			unsubscribeLoading?.();
			unsubscribeLoading = data.loading.subscribe((value) => {
				loadingRef = value;
			});
		} else {
			loadingRef = data.loading;
		}
		if (typeof data.refreshing === 'object' && 'subscribe' in data.refreshing) {
			unsubscribeRefreshing?.();
			unsubscribeRefreshing = data.refreshing.subscribe((value) => {
				refreshingRef = value;
			});
		} else {
			refreshingRef = data.refreshing;
		}
		if (typeof data.hasMore === 'object' && 'subscribe' in data.hasMore) {
			unsubscribeHasMore?.();
			unsubscribeHasMore = data.hasMore.subscribe((value) => {
				hasMoreRef = value;
			});
		} else {
			hasMoreRef = data.hasMore;
		}

		return () => {
			unsubscribePosts?.();
			unsubscribeLoading?.();
			unsubscribeRefreshing?.();
			unsubscribeHasMore?.();
		};
	});
	/* eslint-enable svelte/require-store-reactive-access */

	// 下拉刷新配置常量
	const PULL_REFRESH_CONFIG = {
		MAX_DISTANCE: 120, // 最大下拉距离
		TRIGGER_THRESHOLD: 60, // 触发刷新的阈值
		TRIGGERED_DISTANCE: 60, // 触发刷新后的固定距离
		DAMPING_FACTOR: 0.5 // 阻尼系数
	} as const;

	// 默认配置常量
	const DEFAULT_CONFIG: WaterfallConfig = {
		minCardWidth: 280, // 最小卡片宽度
		gap: 16, // 卡片间距
		bufferSize: 3, // 缓冲区大小（倍数）
		bufferHeight: 400, // 缓冲区高度
		loadingThreshold: 200, // 加载更多阈值
		cardContentHeight: 120, // 卡片内容高度
		skeletonCardCount: 20, // 骨架屏卡片数量
		binarySearchThreshold: 100 // 使用二分查找的阈值
	};

	// 合并配置：默认配置 + 用户配置
	let mergedConfig = $derived({ ...DEFAULT_CONFIG, ...config });

	// 计算布局基础参数：根据容器宽度计算列数和卡片宽度
	function calculateLayoutBase(width: number): { columnCount: number; cardWidth: number } {
		const columnCount = Math.max(1, Math.floor(width / mergedConfig.minCardWidth));
		const cardWidth = (width - (columnCount - 1) * mergedConfig.gap) / columnCount;
		return { columnCount, cardWidth };
	}

	// 找到列高度最低的那一列的索引
	function findMinColumnIndex(columnHeights: number[]): number {
		let minHeight = columnHeights[0]; // 最小高度
		let minIndex = 0; // 最小高度对应的索引
		for (let i = 1; i < columnHeights.length; i++) {
			if (columnHeights[i] < minHeight) {
				minHeight = columnHeights[i];
				minIndex = i;
			}
		}
		return minIndex;
	}

	// 计算所有卡片的位置
	function calculateCardPositions(): void {
		if (containerWidth === 0 || postsRef.length === 0) return;

		const layout = calculateLayoutBase(containerWidth);
		columnCount = layout.columnCount;
		cardWidth = layout.cardWidth;

		columnHeights.length = 0;
		columnHeights.push(...Array(columnCount).fill(0)); // 初始化所有列高度为0

		cardPositions.length = 0;

		for (let i = 0; i < postsRef.length; i++) {
			const post = postsRef[i];
			let coverRatio = 1; // 默认封面宽高比

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

			const minIndex = findMinColumnIndex(columnHeights); // 找到最短的列

			const left = minIndex * (cardWidth + mergedConfig.gap);
			const top = columnHeights[minIndex];

			cardPositions.push({ top, left, width: cardWidth, height: cardHeight });

			columnHeights[minIndex] = top + cardHeight; // 更新列高度（不加gap）
			maxHeight = Math.max(maxHeight, columnHeights[minIndex]);
		}

		if (scrollContainer) {
			scrollContainer.style.height = `${maxHeight}px`; // 设置容器高度
		}
	}

	// 更新可见范围（虚拟滚动优化）
	function updateVisibleRange(): void {
		if (!scrollContainer || !containerElement) return;

		const scrollTop = scrollContainer.scrollTop;
		const containerHeight = containerElement.clientHeight;
		const visibleBuffer = mergedConfig.bufferSize * mergedConfig.bufferHeight; // 缓冲区高度

		const startBuffer = Math.max(0, scrollTop - visibleBuffer); // 可见范围起始位置（包含缓冲区）
		const endBuffer = scrollTop + containerHeight + visibleBuffer; // 可见范围结束位置（包含缓冲区）

		let start = cardPositions.length;
		let end = 0;

		if (cardPositions.length > mergedConfig.binarySearchThreshold) {
			// 卡片数量超过阈值时使用二分查找
			start = findVisibleRangeStart(startBuffer);
			end = findVisibleRangeEnd(endBuffer);
		} else {
			// 卡片数量较少时使用线性查找
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
		visibleRange = { start, end }; // 更新可见范围
	}

	// 使用二分查找找到可见范围的起始索引
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

	// 使用二分查找找到可见范围的结束索引
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

	// 处理滚动事件（节流优化）
	function handleScroll(): void {
		if (scrollFrameId !== null) return; // 防止重复触发

		scrollFrameId = requestAnimationFrame(() => {
			updateVisibleRange();

			if (!scrollContainer) {
				scrollFrameId = null;
				return;
			}

			const scrollTop = scrollContainer.scrollTop;
			const scrollHeight = scrollContainer.scrollHeight;
			const clientHeight = scrollContainer.clientHeight;

			// 检查是否需要加载更多
			if (
				scrollHeight - scrollTop - clientHeight < mergedConfig.loadingThreshold &&
				hasMoreRef &&
				!loadingRef
			) {
				data.loadMore().catch((error) => {
					console.error('Failed to load more posts:', error);
				});
			}

			scrollFrameId = null;
		});
	}

	// 处理下拉刷新
	async function handleRefresh(): Promise<void> {
		if (refreshingRef) return;
		// !NOTE: 这里会对上一轮的数据清空，产生一个白屏画面，是故意为之的，如果不喜欢，注释这两行即可。
		cardPositions = [];
		visibleRange = { start: 0, end: -1 };
		try {
			await data.refresh();
			maxHeight = 0;
			columnHeights = [];
			calculateCardPositions();
			updateVisibleRange();
			if (scrollContainer) {
				scrollContainer.scrollTop = 0;
			}
			pullRefreshDistance = 0;
		} catch (error) {
			console.error('Failed to refresh posts:', error);
			pullRefreshDistance = 0;
		}
	}

	// 处理触摸开始事件
	function handleTouchStart(event: TouchEvent): void {
		if (scrollContainer.scrollTop > 1) return; // 只有在顶部时才能下拉刷新
		startY = event.touches[0].clientY;
		isPulling = true;
	}

	// 处理触摸移动事件
	function handleTouchMove(event: TouchEvent): void {
		if (!isPulling) return;

		if (scrollContainer.scrollTop > 0) {
			resetPullRefresh();
			return;
		}

		const touchY = event.touches[0].clientY;
		currentY = touchY;
		const distance = currentY - startY;

		if (distance <= 0) {
			resetPullRefresh();
			return;
		}

		if (touchMoveFrameId !== null) {
			return;
		}

		touchMoveFrameId = requestAnimationFrame(() => {
			pullRefreshDistance = Math.min(
				distance * PULL_REFRESH_CONFIG.DAMPING_FACTOR,
				PULL_REFRESH_CONFIG.MAX_DISTANCE
			);
			touchMoveFrameId = null;
		});
	}

	// 处理触摸结束事件
	function handleTouchEnd(): void {
		if (!isPulling) return;

		isPulling = false;

		if (pullRefreshDistance >= PULL_REFRESH_CONFIG.TRIGGER_THRESHOLD) {
			pullRefreshDistance = PULL_REFRESH_CONFIG.TRIGGERED_DISTANCE; // 触发刷新
			handleRefresh();
		} else {
			pullRefreshDistance = 0; // 未达到阈值，取消刷新
		}
	}

	// 处理触摸取消事件
	function handleTouchCancel(): void {
		resetPullRefresh();
	}

	// 重置下拉刷新状态
	function resetPullRefresh(): void {
		isPulling = false;
		pullRefreshDistance = 0;
		if (touchMoveFrameId !== null) {
			cancelAnimationFrame(touchMoveFrameId);
			touchMoveFrameId = null;
		}
	}

	// 清理动画帧
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

	// 组件挂载时初始化
	onMount(() => {
		if (!containerElement) return;

		scrollContainer = containerElement;

		// 监听容器尺寸变化
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

		// 注册事件监听器
		scrollContainer.addEventListener('scroll', handleScroll);
		scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
		scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
		scrollContainer.addEventListener('touchend', handleTouchEnd);
		scrollContainer.addEventListener('touchcancel', handleTouchCancel);

		// 初始化布局
		tick().then(() => {
			if (containerElement) {
				containerWidth = containerElement.clientWidth;
				calculateCardPositions();
				updateVisibleRange();
			}
		});
	});

	// 组件卸载时清理
	onDestroy(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
		if (scrollContainer) {
			// 移除事件监听器
			scrollContainer.removeEventListener('scroll', handleScroll);
			scrollContainer.removeEventListener('touchstart', handleTouchStart);
			scrollContainer.removeEventListener('touchmove', handleTouchMove);
			scrollContainer.removeEventListener('touchend', handleTouchEnd);
			scrollContainer.removeEventListener('touchcancel', handleTouchCancel);
		}
		cleanup();
	});

	// 监听帖子数据变化，重新计算布局
	$effect(() => {
		const currentLength = postsRef.length;
		if (currentLength > 0 && currentLength !== lastPostsLength) {
			lastPostsLength = currentLength;
			calculateCardPositions();
			updateVisibleRange();
		}
	});
</script>

<div class="relative h-full w-full overflow-y-auto" bind:this={containerElement}>
	{#if pullRefreshDistance > 0}
		<div
			class="absolute top-0 right-0 left-0 flex items-center justify-center transition-all duration-200"
			style="height: {pullRefreshDistance}px;"
		>
			{#if refreshingRef}
				<Spinner class="mr-2 text-primary" />
				<span class="text-sm text-muted-foreground">正在刷新</span>
			{:else if pullRefreshDistance >= PULL_REFRESH_CONFIG.TRIGGER_THRESHOLD}
				<div
					class="mr-2 text-primary"
					style="transform: rotate({Math.min(
						(pullRefreshDistance / PULL_REFRESH_CONFIG.TRIGGER_THRESHOLD) * 360,
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
						(pullRefreshDistance / PULL_REFRESH_CONFIG.TRIGGER_THRESHOLD) * 360,
						360
					)}deg);"
				>
					<Spinner class="animate-none!" />
				</div>
				<span class="text-sm text-muted-foreground">下拉刷新</span>
			{/if}
		</div>
	{/if}

	{#each postsRef as post, i (i)}
		{#if i >= visibleRange.start && i <= visibleRange.end}
			<div
				class="absolute"
				style="top: {cardPositions[i]?.top + pullRefreshDistance}px; left: {cardPositions[i]
					?.left}px; width: {cardPositions[i]?.width}px; height: {cardPositions[i]?.height}px;"
			>
				<WaterfallCard
					postId={post.post_id || ''}
					title={post.display_title || ''}
					summary=""
					cover={{
						url: post.cover?.single?.url || '',
						ratio:
							post.cover?.single?.meta?.width && post.cover.single.meta?.height
								? post.cover.single.meta.width / post.cover.single.meta.height
								: 1
					}}
					author={{
						avatar: post.author?.avatar || '',
						name: post.author?.name || '',
						id: post.author?.user_id || ''
					}}
					likeCount={Number(post.stats?.like_count) || 0}
					viewCount={Number(post.stats?.view_count) || 0}
					commentCount={Number(post.stats?.comment_count) || 0}
					isLiked={post.relation_status?.is_liked || false}
					isOnlyVideo={post.is_only_video || false}
					publishTime={parseInt(post.publish_time || '0')}
				/>
			</div>
		{/if}
	{/each}

	{#if loadingRef && postsRef.length > 0}
		<div class="flex justify-center py-4">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
		</div>
	{/if}

	{#if !hasMoreRef && postsRef.length > 0}
		<div class="py-4 text-center text-sm text-muted-foreground">没有更多内容了</div>
	{/if}
</div>
