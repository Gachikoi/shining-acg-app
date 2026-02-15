<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	export interface WaterfallItem {
		id: string;
		thumbnail: string;
		isVideo?: boolean;
		title: string;
		userAvatar: string;
		userName: string;
		likeCount: number;
		aspectRatio?: number;
	}

	export interface WaterfallProps extends HTMLAttributes<HTMLDivElement> {
		items: WaterfallItem[];
		columnWidth?: number;
		gap?: number;
		onLoadMore?: () => Promise<WaterfallItem[]> | void;
		hasMore?: boolean;
		cardComponent?: Snippet<[WaterfallItem]>;
	}
</script>

<script lang="ts">
	import Card from '$lib/components/ui/card/card.svelte';
	import { LoaderCircle, AlertCircle, RefreshCw } from 'lucide-svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let {
		items = [],
		columnWidth = 280,
		gap = 16,
		onLoadMore,
		hasMore = true,
		cardComponent,
		class: className,
		...restProps
	}: WaterfallProps = $props();

	let containerRef: HTMLDivElement | undefined = $state();
	let triggerRef: HTMLDivElement | undefined = $state();
	let isLoading = $state(false);
	let loadError = $state(false);
	let hasMoreData = $derived(hasMore);
	let scrollObserver: IntersectionObserver | null = null;
	let resizeObserver: ResizeObserver | null = null;

	let containerWidth = $state(0);
	let columnCount = $state(1);
	let columnHeights = $state<number[]>([]);
	let itemPositions = new SvelteMap<string, { column: number; top: number }>();

	const CARD_CONTENT_HEIGHT = 76;

	function calculateLayout() {
		if (!containerRef || items.length === 0) return;

		const width = containerRef.clientWidth;
		containerWidth = width;

		const cols = Math.max(1, Math.floor((width + gap) / (columnWidth + gap)));
		columnCount = cols;

		const actualColumnWidth = (width - gap * (cols - 1)) / cols;
		const heights = new Array(cols).fill(0);

		itemPositions.clear();

		for (const item of items) {
			const shortestColumn = heights.indexOf(Math.min(...heights));
			const ratio = item.aspectRatio ?? 1;
			const itemHeight = actualColumnWidth / ratio + CARD_CONTENT_HEIGHT;

			itemPositions.set(item.id, {
				column: shortestColumn,
				top: heights[shortestColumn]
			});

			heights[shortestColumn] += itemHeight + gap;
		}

		columnHeights = heights;
	}

	function getItemStyle(item: WaterfallItem): string {
		const position = itemPositions.get(item.id);
		if (!position) return '';

		const width =
			containerWidth > 0 ? (containerWidth - gap * (columnCount - 1)) / columnCount : columnWidth;

		const left = position.column * (width + gap);
		const ratio = item.aspectRatio ?? 1;
		const height = width / ratio + CARD_CONTENT_HEIGHT;

		return `position: absolute; left: ${left}px; top: ${position.top}px; width: ${width}px; height: ${height}px;`;
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
		<div class="relative w-full p-2 sm:p-4" style="height: {getTotalHeight()}px;">
			{#each items as item (item.id)}
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
