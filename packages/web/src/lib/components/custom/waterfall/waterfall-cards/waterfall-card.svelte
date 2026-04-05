<script lang="ts">
	import { breakpoint } from '$lib/modules/device';
	import { formatTime } from '$lib/utils';
	import { Eye, Heart, PlayIcon } from 'lucide-svelte';

	interface UserSummary {
		avatar: string;
		name: string;
		id: string;
	}

	interface Media {
		url: string;
		ratio: number;
	}

	let {
		index,
		title,
		cover,
		author,
		likeCount = '0',
		viewCount = '0',
		isLiked = false,
		isOnlyVideo = false,
		isShowViews = true,
		isShowTime = true,
		publishTime
	}: {
		index: number;
		title: string;
		cover: Media;
		author: UserSummary;
		likeCount?: string;
		viewCount?: string;
		isLiked?: boolean;
		isOnlyVideo?: boolean;
		isShowViews?: boolean;
		isShowTime?: boolean;
		publishTime: number;
	} = $props();

	const getFetchPriority = $derived(
		index < (breakpoint.isLg ? 20 : breakpoint.isMd ? 10 : 5) ? 'high' : 'auto'
	);
</script>

<article
	class="group cursor-pointer overflow-hidden rounded-sm border border-zinc-100 bg-white sm:rounded-md md:rounded-xl lg:rounded-2xl dark:border-zinc-900 dark:bg-black"
>
	<figure
		class="relative overflow-hidden rounded-t-sm bg-zinc-100 sm:rounded-t-md md:rounded-t-xl lg:rounded-t-2xl dark:bg-zinc-900"
	>
		<img
			class="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
			src={cover.url}
			alt={title}
			loading="eager"
			decoding="async"
			style="--aspect-ratio: {cover.ratio};"
			fetchpriority={getFetchPriority}
		/>
		{#if isOnlyVideo}
			<div class="absolute top-2 right-2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
				<PlayIcon class="size-3 fill-white stroke-white" aria-hidden="true"></PlayIcon>
			</div>
		{/if}
		{#if isShowViews}
			<div
				class="absolute bottom-2 left-2 flex items-center gap-0.75 rounded-full bg-black/40 p-1.5 backdrop-blur-sm *:text-white"
				aria-label="ViewCount {viewCount}"
			>
				<Eye class="size-4" aria-hidden="true" />
				<span class="text-xs font-medium">{viewCount}</span>
			</div>
		{/if}
	</figure>

	<footer class="p-3">
		<h3 class="line-clamp-2 text-sm leading-snug font-medium text-zinc-900 dark:text-zinc-100">
			{title}
		</h3>
		<div class="mt-2 flex items-center gap-4" data-author-id={author.id}>
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<img
					class="size-5 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
					src={author.avatar}
					alt={author.name}
					fetchpriority={getFetchPriority}
				/>
				<div class="flex min-w-0 flex-col">
					<span class="truncate text-xs text-zinc-600 dark:text-zinc-400">{author.name}</span>
					{#if isShowTime}
						<span class="text-xs text-zinc-400 dark:text-zinc-500">{formatTime(publishTime)}</span>
					{/if}
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-0.75" aria-label="LikeCount {likeCount}">
				<Heart
					class="size-4 {isLiked
						? 'fill-red-500 text-red-500'
						: 'text-zinc-500 dark:text-zinc-400'}"
					aria-hidden="true"
				/>
				<span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">{likeCount}</span>
			</div>
		</div>
	</footer>
</article>

<style>
	img {
		aspect-ratio: var(--aspect-ratio);
	}
</style>
