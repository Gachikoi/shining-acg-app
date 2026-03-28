<script lang="ts">
	import { fade } from 'svelte/transition';
	import { cn } from '$lib/utils';
	import type { CoverRatio } from '$lib/stores/release';
	import type { CoverSource } from '$lib/modules/media-cover';

	const coverRatioToAspectRatio: Record<CoverRatio, string> = {
		'1:1': 'w-[9.75rem] h-[9.75rem]',
		'4:3': 'w-[13rem] h-[9.75rem]',
		'3:4': 'w-[9.75rem] h-[13rem]'
	} as const;

	let {
		ratio,
		coverUrl = null,
		source = 'text-generated',
		isLoading = false,
		onToggleRatio
	}: {
		ratio: CoverRatio;
		coverUrl?: string | null;
		source?: CoverSource;
		isLoading?: boolean;
		onToggleRatio?: () => void;
	} = $props();

	const sourceTextMap: Record<CoverSource, string> = {
		'selected-image': '图片封面',
		'video-first-frame': '视频首帧',
		'text-generated': '正文封面'
	};

	const sourceText = $derived(sourceTextMap[source]);
</script>

<p class="text-lg font-bold">
	封面设置
	<br class="lg:hidden" />
	<span class="text-sm font-normal text-muted-foreground">
		未设置封面时，以第 1 张图片或视频首帧作为封面；若没有图片或视频，将会使用正文内容自动生成封面。
	</span>
</p>

<button
	type="button"
	class={cn(
		'relative mt-4 flex cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-muted transition-all',
		coverRatioToAspectRatio[ratio]
	)}
	onclick={onToggleRatio}
>
	{#if coverUrl}
		<img src={coverUrl} alt="封面" class="h-full w-full object-cover" draggable="false" />
	{:else}
		<span class="text-xs text-muted-foreground">比例1:1 / 4:3 / 3:4</span>
	{/if}

	{#if isLoading}
		<div class="absolute inset-0 flex items-center justify-center bg-black/30">
			<span class="text-xs text-zinc-100">生成封面中…</span>
		</div>
	{/if}

	<div
		class="pointer-events-none absolute bottom-2 left-2 rounded bg-zinc-900/55 px-1.5 py-0.5 text-[11px] text-zinc-100"
	>
		{sourceText}
	</div>

	{#key ratio}
		<div
			class="pointer-events-none absolute top-5/6 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-zinc-900/60 px-2 py-1 text-xs text-zinc-100"
			in:fade={{ duration: 250 }}
			out:fade={{ duration: 300, delay: 500 }}
		>
			{ratio}
		</div>
	{/key}
</button>
