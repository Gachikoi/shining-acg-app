<script lang="ts">
	import { Waterfall, type WaterfallItem } from '$lib/components/waterfall';
	import { onMount } from 'svelte';

	let currentPage = 0;
	const pageSize = 20;
	let hasMore = $state(true);
	let items = $state<WaterfallItem[]>([]);
	let isInitialized = false;

	const userNames = Array.from({ length: 100 }, (_, i) => `Text UserName ${i}`);

	const titles = Array.from({ length: 100 }, (_, i) => `Test Title ${i}`);

	function generateMockItem(index: number): WaterfallItem {
		const id = `item-${Date.now()}-${index}`;
		const width = 400;
		const heights = [300, 350, 400, 450, 500, 550, 600];
		const height = heights[Math.floor(Math.random() * heights.length)];
		const aspectRatio = width / height;

		return {
			id,
			thumbnail: `https://picsum.photos/seed/${id}/${width}/${height}`,
			isVideo: Math.random() > 0.8,
			title: titles[index],
			userAvatar: `https://i.pravatar.cc/100?u=${id}`,
			userName: userNames[index],
			likeCount: Math.floor(Math.random() * 50000) + 100,
			aspectRatio
		};
	}

	function generateMockItems(count: number, startIndex: number): WaterfallItem[] {
		const newItems: WaterfallItem[] = [];
		for (let i = 0; i < count; i++) {
			newItems.push(generateMockItem(startIndex + i));
		}
		return newItems;
	}

	async function handleLoadMore(): Promise<WaterfallItem[]> {
		if (currentPage >= 5) {
			hasMore = false;
			return [];
		}

		await new Promise((resolve) => setTimeout(resolve, 500));

		const newItems = generateMockItems(pageSize, items.length);
		currentPage++;
		items = [...items, ...newItems];

		return newItems;
	}

	onMount(() => {
		if (!isInitialized) {
			isInitialized = true;
			handleLoadMore();
		}
	});
</script>

<svelte:head>
	<title>首页 - Shining ACG</title>
</svelte:head>

<div class="home-container">
	<div class="home-header">
		<h1 class="home-title">发现</h1>
	</div>

	<div class="waterfall-wrapper">
		<Waterfall {items} columnWidth={280} gap={16} {hasMore} onLoadMore={handleLoadMore} />
	</div>
</div>

<style>
	.home-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background-color: var(--background);
	}

	.home-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.home-title {
		font-size: 24px;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.waterfall-wrapper {
		flex: 1;
		min-height: 0;
	}

	@media (max-width: 640px) {
		.home-header {
			padding: 12px 16px;
		}

		.home-title {
			font-size: 20px;
		}
	}
</style>
