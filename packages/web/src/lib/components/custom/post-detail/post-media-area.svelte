<script lang="ts">
	import type { V1Post as Post } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, ChevronRight, Play } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { getMediaDisplayUrl } from '$lib/media-url';
	import { swipe, tap, GestureType } from '$lib/modules/gesture';
	import { ImageVideoPreview } from '$lib/components/custom/image-video-preview';

	const {
		mediaList = [],
		postTitle = ''
	}: { mediaList?: NonNullable<Post['media']>; postTitle?: string } = $props();

	let activeIndex = $state(0);
	let gestureContainerEl: HTMLDivElement | null = $state(null);
	let panOffsetX = $state(0);
	let lastPanEndTime = 0;
	const PAN_MAX_OFFSET_RATIO = 1.2;
	const TAP_IGNORE_AFTER_PAN_MS = 200;
	$effect(() => {
		// 当 mediaList 变化时，重置索引
		if (mediaList.length === 0) {
			activeIndex = -1;
		} else if (activeIndex >= mediaList.length || activeIndex < 0) {
			activeIndex = 0;
		}
	});
	// 图片视频预览编辑器状态
	let isPreviewEditorOpen = $state(false);
	let previewEditorInitialIndex = $state(0);
	let previewEditorAutoplay = $state(false);

	$effect(() => {
		// props 变更时，若当前索引超出范围，则重置
		if (activeIndex >= mediaList.length) {
			activeIndex = mediaList.length > 0 ? 0 : -1;
		}
	});

	$effect(() => {
		// 关闭预览时重置自动播放标记，避免下次误触发
		if (!isPreviewEditorOpen) {
			previewEditorAutoplay = false;
		}
	});

	function prevMedia() {
		if (mediaList.length <= 1 || activeIndex <= 0) return;
		activeIndex = activeIndex - 1;
	}

	function nextMedia() {
		if (mediaList.length <= 1 || activeIndex >= mediaList.length - 1) return;
		activeIndex = activeIndex + 1;
	}

	function openPreviewEditor(index: number, autoplay = false) {
		previewEditorInitialIndex = index;
		isPreviewEditorOpen = true;
		previewEditorAutoplay = autoplay;
	}

	const swipeOptions = $derived.by(() => ({
		gestureType: GestureType.MEDIA_CAROUSEL,
		onSwipeMove(deltaX: number) {
			const w = gestureContainerEl?.getBoundingClientRect?.().width ?? 400;
			const max = w * PAN_MAX_OFFSET_RATIO;
			panOffsetX = Math.max(-max, Math.min(max, deltaX));
		},
		onSwipeEnd(direction: 'left' | 'right') {
			if (Math.abs(panOffsetX) >= 10) lastPanEndTime = Date.now();
			if (mediaList.length > 1) {
				if (direction === 'right') prevMedia();
				else nextMedia();
			}
			panOffsetX = 0;
		},
		onSwipeCancel() {
			panOffsetX = 0;
		}
	}));
	const tapOptions = $derived.by(() => ({
		excludeSelector: 'button',
		onTap(detail: { target: EventTarget; clientX: number; clientY: number }) {
			if (Date.now() - lastPanEndTime < TAP_IGNORE_AFTER_PAN_MS) return;
			const target = detail.target as HTMLElement;
			if (target?.closest('button')) return;
			let mediaContainer = target?.closest?.('[data-media-index]') as HTMLElement | null;
			if (!mediaContainer && gestureContainerEl && typeof document !== 'undefined') {
				const hit = document.elementFromPoint(detail.clientX, detail.clientY) as HTMLElement | null;
				mediaContainer = hit?.closest?.('[data-media-index]') ?? null;
			}
			if (!mediaContainer) return;
			const mediaIndex = parseInt(mediaContainer.getAttribute('data-media-index') || '-1');
			if (mediaIndex >= 0 && mediaIndex < mediaList.length) {
				openPreviewEditor(mediaIndex);
			}
		}
	}));
</script>

<!-- 媒体滑动区：内部负责 swipe 手势、左右切换、圆点指示和预览 -->
<div
	bind:this={gestureContainerEl}
	class="group relative flex h-full w-full items-center justify-center bg-black/80"
	role="group"
	aria-roledescription="carousel"
	use:swipe={swipeOptions}
	use:tap={tapOptions}
>
	{#if mediaList.length > 0 && activeIndex >= 0}
		<!-- 媒体滑动视口 -->
		<div class="relative h-full w-full overflow-hidden">
			<div
				class="flex h-full w-full transition-transform duration-260 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
				style={`transform: translateX(calc(-${activeIndex * 100}% + ${panOffsetX}px));`}
			>
				{#each mediaList as media, index (media.assetId ?? index)}
					<div
						class="flex h-full w-full flex-[0_0_100%] items-center justify-center"
						data-media-index={index}
					>
						{#if media.type === 'MEDIA_TYPE_IMAGE'}
							<!-- pointer-events: none 让点击落在父级 div[data-media-index]，避免图片默认拖拽导致 tap 无法触发 -->
							<img
								src={getMediaDisplayUrl(media)}
								alt={postTitle}
								draggable="false"
								class="max-h-full max-w-full cursor-pointer object-contain select-none"
								style="pointer-events: none; -webkit-user-drag: none; user-select: none;"
							/>
						{:else}
							<!-- 视频预览：显示第一帧和播放按钮 -->
							<div class="relative flex h-full w-full cursor-pointer items-center justify-center">
								<video
									src={getMediaDisplayUrl(media)}
									class="max-h-full max-w-full object-contain"
									preload="metadata"
									playsinline
									muted
								></video>
								<!-- 播放按钮覆盖层 -->
								<div
									class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20"
								>
									<Button
										variant="ghost"
										size="icon"
										class="pointer-events-auto min-h-16 min-w-16 rounded-full bg-black/50 text-white hover:bg-black/70"
										onclick={(e) => {
											e.stopPropagation();
											openPreviewEditor(index, true);
										}}
									>
										<Play class="size-8" />
									</Button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- 左右切换 -->
		{#if mediaList.length > 1}
			<button
				class="absolute top-1/2 left-3 hidden -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-zinc-100 opacity-0 transition group-hover:opacity-100 hover:bg-black/60 sm:block"
				onclick={prevMedia}
				aria-label="上一张"
				type="button"
			>
				<ChevronLeft class="size-5" />
			</button>
			<button
				class="absolute top-1/2 right-3 hidden -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-zinc-100 opacity-0 transition group-hover:opacity-100 hover:bg-black/60 sm:block"
				onclick={nextMedia}
				aria-label="下一张"
				type="button"
			>
				<ChevronRight class="size-5" />
			</button>

			<!-- 媒体分页圆点 + 热区 -->
			<div class="absolute bottom-3 left-1/2 -translate-x-1/2">
				<div
					class="flex cursor-pointer items-center gap-2 rounded-full bg-transparent px-3 py-1 transition-colors hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
				>
					{#each mediaList as media, index (media.assetId ?? index)}
						<button
							type="button"
							class={cn(
								'h-2 w-2 cursor-pointer rounded-full transition-colors',
								index === activeIndex
									? 'bg-rose-500'
									: 'bg-zinc-300/80 hover:bg-zinc-400 dark:bg-zinc-600/80 dark:hover:bg-zinc-500'
							)}
							onclick={() => (activeIndex = index)}
							aria-label={`查看第 ${index + 1} 张媒体`}
						></button>
					{/each}
				</div>
			</div>
		{/if}
	{:else}
		<div class="flex h-full w-full items-center justify-center text-sm text-zinc-300">
			暂无媒体内容
		</div>
	{/if}
</div>

<!-- 图片视频预览 -->
<ImageVideoPreview
	bind:open={isPreviewEditorOpen}
	{mediaList}
	initialIndex={previewEditorInitialIndex}
	autoplay={previewEditorAutoplay}
	fullScreen={true}
/>
