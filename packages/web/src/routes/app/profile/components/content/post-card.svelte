<script lang="ts">
	import { Heart } from 'lucide-svelte';
	import type { ProfilePostCard } from '../types';

	let {
		item,
		onOpenPost,
		onToggleLike
	}: {
		item: ProfilePostCard;
		onOpenPost: (postId: string) => void;
		onToggleLike: (postId: string) => void;
	} = $props();

	let coverFailed = $state(false);

	$effect(() => {
		void item.coverUrl;
		coverFailed = false;
	});
</script>

<article class="flex flex-col gap-2">
	<button
		type="button"
		class="flex min-h-11 w-full flex-col gap-2 text-left"
		onclick={() => onOpenPost(item.id)}
	>
		<div class="aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
			{#if item.coverUrl && !coverFailed}
				<img
					src={item.coverUrl}
					alt=""
					class="size-full object-cover"
					onerror={() => {
						coverFailed = true;
					}}
				/>
			{/if}
		</div>
		<h2 class="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
			{item.title}
		</h2>
	</button>

	<div class="flex items-center justify-between gap-2">
		<div class="flex min-w-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
			{#if item.authorAvatarUrl}
				<img
					src={item.authorAvatarUrl}
					alt=""
					class="size-5 shrink-0 rounded-full bg-zinc-200 object-cover"
				/>
			{:else}
				<span
					class="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-500 dark:bg-zinc-700"
					aria-hidden="true"
				>
					{item.authorName.slice(0, 1)}
				</span>
			{/if}
			<span class="truncate">{item.authorName}</span>
		</div>

		<button
			type="button"
			class="inline-flex min-h-11 items-center gap-1 px-1 text-xs {item.liked
				? 'text-red-500'
				: 'text-zinc-500'}"
			aria-label={item.liked ? '取消点赞' : '点赞'}
			onclick={(e) => {
				e.stopPropagation();
				onToggleLike(item.id);
			}}
		>
			<Heart class="size-3.5 {item.liked ? 'fill-current' : ''}" aria-hidden="true" />
			{item.likeCount}
		</button>
	</div>
</article>
