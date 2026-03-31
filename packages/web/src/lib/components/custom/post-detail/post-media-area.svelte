<script lang="ts">
	/**
	 * PostDetail 媒体区：展示帖子 `media` 列表的轮播与缩略切换，并打开 `ImageVideoPreview`。
	 * 手势与 `ImageVideoPreview` 内逻辑独立；展示 URL 使用 `$lib/utils/media-url.getMediaDisplayUrl`。
	 */
	import type { V1Post as Post } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, ChevronRight, Play } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { getMediaDisplayUrl } from '$lib/utils/media-url';
	import type { Axis } from '$lib/modules/gesture';
	import { registerScrollBoundary, swipe, tap } from '$lib/modules/gesture';
	import { ImageVideoPreview } from '$lib/components/custom/image-video-preview';

	const {
		mediaList = [],
		postTitle = ''
	}: { mediaList?: NonNullable<Post['media']>; postTitle?: string } = $props();

	let activeIndex = $state(0);
	let gestureContainerEl: HTMLDivElement | null = $state(null);
	let panOffsetX = $state(0);
	const PAN_MAX_OFFSET_RATIO = 1.2;
	$effect(() => {
		// 当 mediaList 变化时，重置索引
		if (mediaList.length === 0) {
			activeIndex = -1;
		} else if (activeIndex >= mediaList.length || activeIndex < 0) {
			activeIndex = 0;
		}
	});
	// 图片视频预览器状态
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
		onMove(state: { deltaX: number }) {
			const w = gestureContainerEl?.getBoundingClientRect?.().width ?? 400;
			const max = w * PAN_MAX_OFFSET_RATIO;
			panOffsetX = Math.max(-max, Math.min(max, state.deltaX));
		},
		onEnd(state: { committed: boolean; direction: 'left' | 'right' }) {
			if (state.committed && mediaList.length > 1) {
				if (state.direction === 'right') prevMedia();
				else nextMedia();
			}
			panOffsetX = 0;
		}
	}));
	/**
	 * 与 SwipeablePane 父级横向 swipe 协作：在仍可切换当前帖内媒体时拒绝外层分类滑动；
	 * 在首张/末张继续向外滑时 canScroll 为 false，内层 swipe 被拒，让渡给 SwipeablePane。
	 */
	$effect(() => {
		const el = gestureContainerEl;
		if (!el) return;
		return registerScrollBoundary(el, {
			axis: 'x',
			canScroll(queryAxis: Axis, direction: number): boolean {
				if (queryAxis !== 'x') return false;
				if (mediaList.length <= 1) return false;
				if (direction > 0) return activeIndex > 0;
				return activeIndex < mediaList.length - 1;
			}
		});
	});

	const tapOptions = $derived.by(() => ({
		excludeSelector: 'button',
		onTap(detail: { target: EventTarget | null; clientX: number; clientY: number }) {
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
	class="group relative flex h-full min-h-0 w-full min-w-0 items-center justify-center bg-black/80"
	role="group"
	aria-roledescription="carousel"
	use:swipe={swipeOptions}
	use:tap={tapOptions}
>
	{#if mediaList.length > 0 && activeIndex >= 0}
		<!-- 媒体滑动视口：min-w-0 避免 flex 子项撑破；轨道用 translate3d 减少子像素缝隙 -->
		<div class="relative h-full min-h-0 w-full min-w-0 overflow-hidden">
			<div
				class="flex h-full w-full transition-transform duration-260 ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform"
				style={`transform: translate3d(calc(-${activeIndex * 100}% + ${panOffsetX}px), 0, 0);`}
			>
				{#each mediaList as media, index (media.assetId ?? index)}
					<div
						class="box-border flex h-full min-h-0 w-full min-w-full flex-[0_0_100%] shrink-0 basis-full items-center justify-center overflow-hidden bg-black"
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
			<div
				data-preview-nav
				class="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 opacity-60 transition-opacity group-hover:opacity-100"
			>
				<div class="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5">
					{#each mediaList as media, index (media.assetId ?? index)}
						<button
							type="button"
							class={cn(
								'h-2 w-2 cursor-pointer rounded-full transition-colors',
								index === activeIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/75'
							)}
							onclick={(e) => {
								e.stopPropagation();
								activeIndex = index;
							}}
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
