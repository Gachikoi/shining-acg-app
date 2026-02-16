<script lang="ts" module>
	// TODO:
	// - [ ] Skeleton Screen
	// - [ ] Restore the scroll position

	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export interface WaterfallItem {
		id: string;
		// 缩略图链接
		thumbnail: string;
		// 是否是视频
		isVideo?: boolean;
		// 标题
		title: string;
		// 用户头像
		userAvatar: string;
		// 用户名
		userName: string;
		// 喜欢数量
		likeCount: number;
		// 缩略图比例
		aspectRatio: number;
	}

	export interface WaterfallProps extends HTMLAttributes<HTMLDivElement> {
		// 卡片数组
		items: WaterfallItem[];
		// 默认的列宽
		columnWidth?: number;
		// 卡片最小宽度
		minColumnWidth?: number;
		// 卡片之间的间隔
		gap?: number;
		// 加载更多的函数
		onLoadMore?: () => Promise<WaterfallItem[]> | void;
		// 是否有更多数据的标记
		hasMore?: boolean;
		// 卡片组件
		cardComponent?: Snippet<[WaterfallItem]>;
		// 虚拟滚动缓冲区行数
		overscan?: number;
		// 卡片底部的内容的高度
		cardContentHeight?: number;
	}
</script>

<script lang="ts">
	import Card from '$lib/components/ui/card/card.svelte';
	import { LoaderCircle, AlertCircle, RefreshCw } from 'lucide-svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let {
		items = [],
		columnWidth = 200,
		minColumnWidth = 100,
		gap = 16,
		onLoadMore,
		hasMore = true,
		cardComponent,
		class: className,
		overscan = 3,
		cardContentHeight = 76,
		...restProps
	}: WaterfallProps = $props();

	let containerRef: HTMLDivElement | undefined = $state();
	let contentRef: HTMLDivElement | undefined = $state();
	let triggerRef: HTMLDivElement | undefined = $state();
	let isLoading = $state(false);
	let loadError = $state(false);
	let hasMoreData = $derived(hasMore);
	let scrollObserver: IntersectionObserver | null = null;
	let resizeObserver: ResizeObserver | null = null;

	let containerWidth = $state(0);
	let columnCount = $state(1);
	let columnHeights = $state<number[]>([]);
	let itemPositions = new SvelteMap<string, { column: number; top: number; height: number }>();

	// 虚拟滚动相关状态
	let scrollTop = $state(0);
	let containerHeight = $state(0);

	function calculateLayout() {
		if (!containerRef || !contentRef || items.length === 0) return;

		// 使用内容区域的实际宽度，避免滚动条和 padding 影响
		const width = contentRef.clientWidth;
		containerWidth = width;
		containerHeight = containerRef.clientHeight;

		// 先按理想宽度计算列数
		let cols = Math.max(1, Math.floor((width + gap) / (columnWidth + gap)));

		// 检查实际列宽是否小于最小宽度，如果是则减少列数
		let actualColumnWidth = (width - gap * (cols - 1)) / cols;
		while (cols > 1 && actualColumnWidth < minColumnWidth) {
			cols--;
			actualColumnWidth = (width - gap * (cols - 1)) / cols;
		}

		columnCount = cols;
		const heights = new Array(cols).fill(0);

		itemPositions.clear();

		for (const item of items) {
			const shortestColumn = heights.indexOf(Math.min(...heights));
			const ratio = item.aspectRatio ?? 1;
			const itemHeight = actualColumnWidth / ratio + cardContentHeight;

			itemPositions.set(item.id, {
				column: shortestColumn,
				top: heights[shortestColumn],
				height: itemHeight
			});

			heights[shortestColumn] += itemHeight + gap;
		}

		columnHeights = heights;
	}

	// 计算可见区域内的项目
	let visibleItems = $derived.by(() => {
		if (items.length === 0 || containerHeight === 0) return items;

		// 计算可见区域的上下边界（加上 overscan 缓冲区）
		const overscanHeight = overscan * (columnWidth + cardContentHeight + gap);
		const viewportTop = Math.max(0, scrollTop - overscanHeight);
		const viewportBottom = scrollTop + containerHeight + overscanHeight;

		return items.filter((item) => {
			const position = itemPositions.get(item.id);
			if (!position) return true; // 位置未计算时显示

			const itemTop = position.top;
			const itemBottom = position.top + position.height;

			// 检查项目是否在可见区域内
			return itemBottom >= viewportTop && itemTop <= viewportBottom;
		});
	});

	function handleScroll(event: Event) {
		const target = event.target as HTMLDivElement;
		scrollTop = target.scrollTop;
	}

	function getItemStyle(item: WaterfallItem): string {
		const position = itemPositions.get(item.id);
		if (!position) return '';

		const width =
			containerWidth > 0 ? (containerWidth - gap * (columnCount - 1)) / columnCount : columnWidth;

		const left = position.column * (width + gap);

		return `position: absolute; left: ${left}px; top: ${position.top}px; width: ${width}px; height: ${position.height}px;`;
	}

	function getTotalHeight(): number {
		if (columnHeights.length === 0) return 0;
		return Math.max(...columnHeights);
	}

	async function loadMore() {
		if (isLoading || !hasMoreData || loadError) return;

		isLoading = true;
		loadError = false;

		try {
			if (onLoadMore) {
				const newItems = await Promise.resolve(onLoadMore());
				if (!newItems || newItems.length === 0) {
					hasMoreData = false;
				}
			}
		} catch (error) {
			console.error('Failed to load more items:', error);
			loadError = true;
		} finally {
			isLoading = false;
		}
	}

	function retryLoad() {
		loadError = false;
		loadMore();
	}

	$effect(() => {
		if (items.length > 0) {
			calculateLayout();
		}
	});

	$effect(() => {
		const container = containerRef;
		const trigger = triggerRef;

		if (!container || !trigger) return;

		resizeObserver = new ResizeObserver(() => {
			calculateLayout();
		});
		resizeObserver.observe(container);
		if (contentRef) {
			resizeObserver.observe(contentRef);
		}

		scrollObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && !isLoading && hasMoreData && !loadError) {
						loadMore();
					}
				}
			},
			{
				root: container,
				rootMargin: '200px',
				threshold: 0
			}
		);
		scrollObserver.observe(trigger);

		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}
			if (scrollObserver) {
				scrollObserver.disconnect();
				scrollObserver = null;
			}
		};
	});
</script>

<div
	bind:this={containerRef}
	class="relative h-full w-full overflow-x-hidden overflow-y-auto px-3 pt-3 {className}"
	onscroll={handleScroll}
	{...restProps}
>
	{#if items.length === 0 && !isLoading}
		<div
			class="flex h-full min-h-[300px] flex-col items-center justify-center text-muted-foreground"
		>
			<div class="mb-4 text-5xl opacity-50">📭</div>
			<div class="text-sm">暂无内容</div>
		</div>
	{:else}
		<div bind:this={contentRef} class="relative w-full" style="height: {getTotalHeight()}px;">
			{#each visibleItems as item (item.id)}
				<div class="absolute" style={getItemStyle(item)}>
					{#if cardComponent}
						{@render cardComponent(item)}
					{:else}
						<Card
							thumbnail={item.thumbnail}
							isVideo={item.isVideo}
							title={item.title}
							userAvatar={item.userAvatar}
							userName={item.userName}
							likeCount={item.likeCount}
							aspectRatio={item.aspectRatio}
						/>
					{/if}
				</div>
			{/each}
		</div>

		{#if hasMoreData || isLoading || loadError}
			<div
				bind:this={triggerRef}
				class="absolute right-0 left-0 flex min-h-[60px] items-center justify-center p-6"
				style="top: {getTotalHeight()}px;"
			>
				{#if isLoading}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<div class="flex animate-spin items-center justify-center">
							<LoaderCircle size={16} />
						</div>
						<span>加载中...</span>
					</div>
				{:else if loadError}
					<button
						type="button"
						class="flex cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-4 py-2 text-sm text-destructive transition-colors duration-200 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						onclick={retryLoad}
					>
						<AlertCircle class="size-4" />
						<span>加载失败，点击重试</span>
						<RefreshCw class="size-3.5" />
					</button>
				{:else if hasMoreData}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<div class="flex animate-spin items-center justify-center">
							<LoaderCircle size={16} />
						</div>
						<span>加载更多...</span>
					</div>
				{/if}
			</div>
		{:else if items.length > 0}
			<div
				class="absolute right-0 left-0 flex items-center justify-center p-6 text-sm text-muted-foreground"
				style="top: {getTotalHeight()}px;"
			>
				<span>暂无更多内容</span>
			</div>
		{/if}
	{/if}
</div>
