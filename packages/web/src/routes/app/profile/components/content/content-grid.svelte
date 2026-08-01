<script lang="ts">
	import PostCard from './post-card.svelte';
	import type { ProfileContentTabId, ProfilePostCard } from '../types';

	let {
		items,
		activeTab,
		onOpenPost,
		onToggleLike
	}: {
		items: ProfilePostCard[];
		activeTab: ProfileContentTabId;
		onOpenPost: (postId: string) => void;
		onToggleLike: (postId: string) => void;
	} = $props();

	void activeTab;
</script>

{#if items.length === 0}
	<p class="py-16 text-center text-sm text-zinc-400">暂无内容</p>
{:else}
	<div class="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
		{#each items as item (item.id)}
			<PostCard {item} {onOpenPost} {onToggleLike} />
		{/each}
	</div>
{/if}
