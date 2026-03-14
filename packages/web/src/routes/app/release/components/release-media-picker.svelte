<script lang="ts">
	import { PlusIcon, XIcon } from 'lucide-svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Label } from '$lib/components/ui/label';
	import type { DraftMediaItem } from '$lib/stores/release';

	let {
		items,
		urls,
		maxCount,
		onFileSelect,
		onRemove
	}: {
		items: DraftMediaItem[];
		urls: string[];
		maxCount: number;
		onFileSelect: (event: Event) => void;
		onRemove: (index: number) => void;
	} = $props();

	let mediaFileInputRef: HTMLInputElement | null = null;

	// 使用 attachment 记录隐藏 input 引用，仅用于触发系统文件选择器。
	const captureMediaFileInput: Attachment<HTMLInputElement> = (element) => {
		mediaFileInputRef = element;
		return () => {
			if (mediaFileInputRef === element) {
				mediaFileInputRef = null;
			}
		};
	};

	function handleAddMediaClick(): void {
		mediaFileInputRef?.click();
	}
</script>

<!-- 图片/视频选择器 - 需求 6.2.5.1-2 -->
<Label class="mt-6 text-lg font-bold">选择图片/视频</Label>
<p class="text-sm text-muted-foreground">最多 {maxCount} 张，已选 {items.length} 张</p>

<!-- 隐藏文件 input：accept 同时支持图片和视频 -->
<input
	{@attach captureMediaFileInput}
	type="file"
	accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime,video/x-m4v,video/webm"
	multiple
	class="hidden"
	onchange={onFileSelect}
/>

<div class="mt-3 flex flex-wrap gap-2">
	{#each items as _, index (index)}
		<!-- 缩略图 + 删除按钮叠层 -->
		<div class="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
			<img
				src={urls[index]}
				alt={`媒体 ${index + 1}`}
				class="h-full w-full object-cover"
				draggable="false"
			/>
			<!-- 删除按钮覆盖在右上角 -->
			<button
				class="absolute top-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-zinc-900/60 text-zinc-100 hover:bg-zinc-900/80"
				onclick={() => onRemove(index)}
				aria-label="删除"
			>
				<XIcon class="size-3" />
			</button>
		</div>
	{/each}
	<!-- 仅在未达上限时显示添加按钮 -->
	{#if items.length < maxCount}
		<button
			class="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-muted hover:bg-muted-foreground/10"
			onclick={handleAddMediaClick}
			aria-label="添加图片/视频"
		>
			<PlusIcon class="size-4 text-muted-foreground" />
		</button>
	{/if}
</div>
