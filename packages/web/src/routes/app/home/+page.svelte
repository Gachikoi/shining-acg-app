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
			userAvatar: `https://gravatar.loli.net/avatar`,
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

<div class="flex h-full w-full flex-col bg-background">
	<div
		class="flex shrink-0 items-center justify-between border-b border-border px-6 py-4 max-sm:px-4 max-sm:py-3 sm:px-6 sm:py-4"
	>
		<h1 class="m-0 text-2xl font-semibold text-foreground max-sm:text-xl">发现</h1>
	</div>

	<div class="min-h-0 grow">
		<Waterfall {items} columnWidth={280} gap={16} {hasMore} onLoadMore={handleLoadMore} />
	</div>
</div>
