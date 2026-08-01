<script lang="ts">
	import type { ProfileStatId } from '../types';

	let {
		followingCount,
		followersCount,
		likesCollectCount,
		onStatClick
	}: {
		followingCount: number;
		followersCount: number;
		likesCollectCount: number;
		onStatClick: (id: ProfileStatId) => void;
	} = $props();

	const items: { id: ProfileStatId; label: string; value: number }[] = $derived([
		{ id: 'following', label: '关注', value: followingCount },
		{ id: 'followers', label: '粉丝', value: followersCount },
		{ id: 'likesCollect', label: '获赞与收藏', value: likesCollectCount }
	]);
</script>

<div class="flex flex-wrap items-center gap-4 text-sm">
	{#each items as item (item.id)}
		<button
			type="button"
			class="inline-flex min-h-11 items-baseline gap-1 px-1 text-left"
			onclick={() => onStatClick(item.id)}
		>
			<span class="text-zinc-500 dark:text-zinc-400">{item.label}</span>
			<span class="font-semibold text-zinc-900 dark:text-zinc-50">{item.value}</span>
		</button>
	{/each}
</div>
