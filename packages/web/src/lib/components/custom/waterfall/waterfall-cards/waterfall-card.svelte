<script lang="ts">
	import { PlayIcon, Heart, Eye, MessageCircle } from 'lucide-svelte';
	import { formatTime } from '../util';

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
		postId,
		title,
		summary,
		cover,
		author,
		likeCount = '0',
		viewCount = '0',
		commentCount = '0',
		isLiked = false,
		isOnlyVideo = false,
		publishTime
	}: {
		postId: string;
		title: string;
		summary: string | undefined;
		cover: Media;
		author: UserSummary;
		likeCount?: string;
		viewCount?: string;
		commentCount?: string;
		isLiked?: boolean;
		isOnlyVideo?: boolean;
		publishTime: number;
	} = $props();
</script>

<article
	data-post-id={postId}
	class="group cursor-pointer rounded-xl border border-border shadow-md"
>
	<figure class="relative overflow-hidden rounded-xl bg-gray-100">
		<img
			class="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
			src={cover.url}
			alt={title}
			loading="lazy"
			style="--aspect-ratio: {cover.ratio};"
		/>
		{#if isOnlyVideo}
			<div class="absolute top-2 right-2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
				<PlayIcon class="size-4 text-white" aria-hidden="true"></PlayIcon>
			</div>
		{/if}
	</figure>

	<footer class="my-2 p-2">
		<h3 class="line-clamp-2 text-sm leading-snug font-medium text-gray-900 dark:text-gray-100">
			{title}
		</h3>
		{#if summary}
			<p class="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{summary}</p>
		{/if}

		<div class="mt-2 flex items-center justify-between" data-author-id={author.id}>
			<div class="flex items-center gap-1.5">
				<img
					class="size-4.5 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
					src={author.avatar}
					alt={author.name}
				/>
				<span class="max-w-20 truncate text-xs text-gray-600 dark:text-gray-400">{author.name}</span
				>
			</div>
			<span class="text-xs text-gray-400 dark:text-gray-500">{formatTime(publishTime)}</span>
		</div>

		<div class="mt-1.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
			<div class="flex items-center gap-0.5" aria-label="LikeCount {likeCount}">
				<Heart class="size-3.5 {isLiked ? 'fill-red-500 text-red-500' : ''}" aria-hidden="true" />
				<span class="font-medium">{likeCount}</span>
			</div>
			<div class="flex items-center gap-0.5" aria-label="ViewCount {viewCount}">
				<Eye class="size-3.5" aria-hidden="true" />
				<span class="font-medium">{viewCount}</span>
			</div>
			<div class="flex items-center gap-0.5" aria-label="CommentCount {commentCount}">
				<MessageCircle class="size-3.5" aria-hidden="true" />
				<span class="font-medium">{commentCount}</span>
			</div>
		</div>
	</footer>
</article>

<style>
	img {
		aspect-ratio: var(--aspect-ratio);
	}
</style>
