<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export interface CardProps extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
		thumbnail: string;
		isVideo?: boolean;
		title: string;
		userAvatar: string;
		userName: string;
		likeCount: number;
		aspectRatio?: number;
	}
</script>

<script lang="ts">
	import { Play, Heart } from 'lucide-svelte';

	let {
		thumbnail,
		isVideo = false,
		title,
		userAvatar,
		userName,
		likeCount,
		aspectRatio = 1,
		class: className,
		ref = $bindable(null),
		...restProps
	}: CardProps = $props();

	function formatLikeCount(count: number): string {
		if (count >= 10000) {
			return (count / 10000).toFixed(1) + 'w';
		} else if (count >= 1000) {
			return (count / 1000).toFixed(1) + 'k';
		}
		return count.toString();
	}

	let imageLoaded = $state(false);

	function handleImageLoad() {
		imageLoaded = true;
	}

	function handleImageError() {
		imageLoaded = true;
	}
</script>

<div
	bind:this={ref}
	data-slot="card"
	class={cn(
		'overflow-hidden rounded-xl border border-border bg-card shadow-lg transition-shadow duration-300 hover:shadow-md',
		className
	)}
	{...restProps}
>
	<div class="relative w-full" style="aspect-ratio: {aspectRatio};">
		{#if !imageLoaded}
			<div class="absolute inset-0 animate-pulse bg-muted"></div>
		{/if}
		<img
			src={thumbnail}
			alt={title}
			loading="lazy"
			decoding="async"
			class="block h-full w-full object-cover transition-opacity duration-200 {imageLoaded
				? 'opacity-100'
				: 'opacity-0'}"
			onload={handleImageLoad}
			onerror={handleImageError}
		/>
		{#if isVideo}
			<div
				class="absolute flex size-6 items-center justify-center rounded-full"
				style="top: 1rem; right: 1rem; background: rgba(64, 64, 64, 0.2); backdrop-filter: blur(20px);"
			>
				<Play class="size-3 fill-[#f4f4f5] text-[#f4f4f5]" />
			</div>
		{/if}
	</div>

	<div class="p-3">
		<h3 class="line-clamp-2 text-sm leading-6 font-medium text-card-foreground">
			{title}
		</h3>

		<div class="mt-2 flex items-center justify-between">
			<div class="flex items-center gap-1.5">
				<img
					src={userAvatar}
					alt={userName}
					loading="lazy"
					class="size-5 rounded-full object-cover"
				/>
				<span class="text-xs leading-5 font-normal text-muted-foreground">
					{userName}
				</span>
			</div>

			<div class="flex items-center gap-1">
				<Heart class="size-4 text-muted-foreground" />
				<span class="text-xs leading-5 font-normal text-muted-foreground">
					{formatLikeCount(likeCount)}
				</span>
			</div>
		</div>
	</div>
</div>
