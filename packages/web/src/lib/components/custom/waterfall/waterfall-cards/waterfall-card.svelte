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
		likeCount = 0,
		viewCount = 0,
		commentCount = 0,
		isLiked = false,
		isOnlyVideo = false,
		publishTime
	}: {
		postId: string;
		title: string;
		summary: string | undefined;
		cover: Media;
		author: UserSummary;
		likeCount?: number;
		viewCount?: number;
		commentCount?: number;
		isLiked?: boolean;
		isOnlyVideo?: boolean;
		publishTime: number;
	} = $props();
</script>

<article data-post-id={postId}>
	<figure class="relative overflow-hidden rounded-lg">
		<img
			class="h-auto w-full object-cover"
			src={cover.url}
			alt={title}
			loading="lazy"
			style="--aspect-ratio: {cover.ratio};"
		/>
		{#if isOnlyVideo}
			<div class="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 backdrop-blur-sm">
				<PlayIcon class="size-4 text-white" aria-hidden="true"></PlayIcon>
			</div>
		{/if}
	</figure>

	<footer class="mt-2 px-1">
		<h3 class="line-clamp-2 text-sm font-medium text-foreground">{title}</h3>
		{#if summary}
			<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{summary}</p>
		{/if}

		<div class="mt-2 flex items-center justify-between" data-author-id={author.id}>
			<div class="flex items-center gap-2">
				<img class="size-5 rounded-full object-cover" src={author.avatar} alt={author.name} />
				<span class="text-xs text-muted-foreground">{author.name}</span>
			</div>
			<span class="text-xs text-muted-foreground">{formatTime(publishTime)}</span>
		</div>

		<div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
			<div class="flex items-center gap-0.5" aria-label="LikeCount {likeCount}">
				<Heart class="size-3.5 {isLiked ? 'fill-red-500 text-red-500' : ''}" aria-hidden="true" />
				<span>{likeCount}</span>
			</div>
			<div class="flex items-center gap-0.5" aria-label="ViewCount {likeCount}">
				<Eye class="size-3.5" aria-hidden="true" />
				<span>{viewCount}</span>
			</div>
			<div class="flex items-center gap-0.5" aria-label="CommentCount {likeCount}">
				<MessageCircle class="size-3.5" aria-hidden="true" />
				<span>{commentCount}</span>
			</div>
		</div>
	</footer>
</article>

<style>
	img {
		aspect-ratio: var(--aspect-ratio);
	}
</style>
