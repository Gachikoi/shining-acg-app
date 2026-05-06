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
	import { scrollBoundary, swipe, tap, type SwipeState } from '$lib/modules/gesture';
	import {
		ImageVideoPreview,
		applyCommittedCarouselSwipe,
		computeInlineCarouselPan
	} from '$lib/components/custom/image-video-preview';

	const {
		mediaList = [],
		/** 保留供父级传入；媒体图用 `alt=""`，失败时不以标题占位 */
		postTitle: _postTitle = ''
	}: { mediaList?: NonNullable<Post['media']>; postTitle?: string } = $props();

	let activeIndex = $state(0);
	/** 包住媒体轨道 + 全屏预览，向 Arena 声明横向「永远有余量」，阻断首页 SwipeablePane 抢手势 */
	let homeSwipeShieldEl: HTMLDivElement | null = $state(null);
	let gestureContainerEl: HTMLDivElement | null = $state(null);
	let panOffsetX = $state(0);
	$effect(() => {
		const len = mediaList.length;
		if (len === 0) {
			activeIndex = -1;
			return;
		}
		if (activeIndex < 0 || activeIndex >= len) {
			activeIndex = 0;
		}
	});
	// 图片视频预览器状态
	let isPreviewEditorOpen = $state(false);
	let previewEditorInitialIndex = $state(0);
	let previewEditorAutoplay = $state(false);
	/** 全屏预览图片边缘拖拽时，帖内媒体区盖空白（由 ImageVideoPreview 驱动） */
	let previewEdgeBlank = $state(false);

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

	/**
	 * 供全屏预览飞回动画读取终点几何：图片与预览器一致取 `img` 的 `getBoundingClientRect`（object-fit: contain 后真实显示框），视频仍用槽位容器。
	 *
	 * @param index - `data-media-index`
	 * @returns 屏幕矩形，无节点时 null
	 */
	/**
	 * 图片加载失败：不展示 alt/URL 占位，仅保留槽位父级背景。
	 *
	 * @param e - img error 事件
	 */
	function onPostMediaImageError(e: Event) {
		const el = e.currentTarget;
		if (el instanceof HTMLImageElement) el.style.display = 'none';
	}

	function readMediaSlotRect(index: number): DOMRect | null {
		if (!gestureContainerEl) return null;
		const slot = gestureContainerEl.querySelector(`[data-media-index="${index}"]`);
		if (!slot) return null;
		const item = mediaList[index];
		if (item?.type === 'MEDIA_TYPE_IMAGE') {
			const img = slot.querySelector('img');
			if (img) return img.getBoundingClientRect();
		}
		return slot.getBoundingClientRect();
	}

	const homeSwipeShieldOpts = $derived.by(() => ({
		axis: 'x' as const,
		canScroll(queryAxis: 'x' | 'y', _direction: number) {
			if (queryAxis !== 'x') return false;
			return mediaList.length > 0 || isPreviewEditorOpen;
		}
	}));

	const swipeOptions = $derived.by(() => ({
		onMove(state: SwipeState) {
			const w = gestureContainerEl?.getBoundingClientRect?.().width ?? 400;
			panOffsetX = computeInlineCarouselPan({
				deltaX: state.deltaX,
				containerWidth: w,
				activeIndex,
				mediaCount: mediaList.length
			});
		},
		onEnd(state: SwipeState) {
			applyCommittedCarouselSwipe(state, {
				mediaCount: mediaList.length,
				currentIndex: activeIndex,
				onPrev: prevMedia,
				onNext: nextMedia
			});
			panOffsetX = 0;
		}
	}));

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

<!-- 外层 shield：全屏预览挂载在其下，触摸预览层时仍阻断首页分类横滑 -->
<div
	bind:this={homeSwipeShieldEl}
	class="relative flex h-full min-h-0 w-full min-w-0 flex-col"
	use:scrollBoundary={homeSwipeShieldOpts}
>
	<!-- 媒体滑动区：内部负责 swipe 手势、左右切换、圆点指示 -->
	<div
		bind:this={gestureContainerEl}
		class="group relative flex h-full min-h-0 w-full min-w-0 flex-1 items-center justify-center bg-[#f7f3ee] dark:bg-black/80"
		role="group"
		aria-roledescription="carousel"
		use:swipe={swipeOptions}
		use:tap={tapOptions}
	>
		{#if mediaList.length > 0 && activeIndex >= 0}
			<!-- 媒体滑动视口：min-w-0 避免 flex 子项撑破；轨道用 translate3d 减少子像素缝隙 -->
			<div class="relative h-full min-h-0 w-full min-w-0 overflow-hidden">
				{#if previewEdgeBlank}
					<div
						class="pointer-events-none absolute inset-0 z-20 bg-[#f7f3ee] dark:bg-zinc-950"
						aria-hidden="true"
					></div>
				{/if}
				<div
					class={cn(
						'relative z-0 flex h-full w-full transition-transform duration-260 ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform',
						previewEdgeBlank && 'opacity-0 transition-opacity duration-150'
					)}
					style={`transform: translate3d(calc(-${activeIndex * 100}% + ${panOffsetX}px), 0, 0);`}
				>
					{#each mediaList as media, index (media.assetId ?? index)}
						<div
							class="box-border flex h-full min-h-0 w-full min-w-full flex-[0_0_100%] shrink-0 basis-full items-center justify-center overflow-hidden bg-[#f7f3ee] dark:bg-black"
							data-media-index={index}
						>
							{#if media.type === 'MEDIA_TYPE_IMAGE'}
								<!-- pointer-events: none 让点击落在父级 div[data-media-index]，避免图片默认拖拽导致 tap 无法触发 -->
								<img
									src={getMediaDisplayUrl(media)}
									alt=""
									role="presentation"
									draggable="false"
									class="max-h-full max-w-full cursor-pointer object-contain select-none"
									style="pointer-events: none; -webkit-user-drag: none; user-select: none;"
									onerror={onPostMediaImageError}
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

			<!-- 左右切换：仅多图/多段媒体；sm 及以上与全屏预览一致，首尾禁用态 + not-allowed -->
			{#if mediaList.length > 1}
				<button
					type="button"
					disabled={activeIndex === 0}
					class={cn(
						'absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full p-2 opacity-0 transition group-hover:opacity-100 sm:block',
						'bg-zinc-900/15 text-zinc-800 dark:bg-black/40 dark:text-zinc-100',
						activeIndex === 0
							? 'cursor-not-allowed opacity-30 hover:bg-zinc-900/15 dark:hover:bg-black/40'
							: 'cursor-pointer hover:bg-zinc-900/25 dark:hover:bg-black/60'
					)}
					onclick={prevMedia}
					aria-label="上一张"
				>
					<ChevronLeft class="size-5" />
				</button>
				<button
					type="button"
					disabled={activeIndex >= mediaList.length - 1}
					class={cn(
						'absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full p-2 opacity-0 transition group-hover:opacity-100 sm:block',
						'bg-zinc-900/15 text-zinc-800 dark:bg-black/40 dark:text-zinc-100',
						activeIndex >= mediaList.length - 1
							? 'cursor-not-allowed opacity-30 hover:bg-zinc-900/15 dark:hover:bg-black/40'
							: 'cursor-pointer hover:bg-zinc-900/25 dark:hover:bg-black/60'
					)}
					onclick={nextMedia}
					aria-label="下一张"
				>
					<ChevronRight class="size-5" />
				</button>
			{/if}
		{:else}
			<div
				class="flex h-full w-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-300"
			>
				暂无媒体内容
			</div>
		{/if}
	</div>

	{#if mediaList.length > 1}
		<!-- 分页圆点独立于媒体区，避免与图片内容重叠 -->
		<div
			data-preview-nav
			class="mt-3 mb-2 flex justify-center opacity-70 transition-opacity group-hover:opacity-100"
		>
			<div class="flex items-center gap-2 rounded-full bg-zinc-900/10 px-3 py-1.5 dark:bg-black/40">
				{#each mediaList as media, index (media.assetId ?? index)}
					<button
						type="button"
						class={cn(
							'h-2 w-2 cursor-pointer rounded-full transition-colors',
							index === activeIndex
								? 'bg-zinc-800 dark:bg-white'
								: 'bg-zinc-400/70 hover:bg-zinc-500 dark:bg-white/50 dark:hover:bg-white/75'
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

	<!-- 图片视频预览（与上列同属 shield，避免 fixed 层落在 scrollBoundary 外） -->
	<ImageVideoPreview
		bind:open={isPreviewEditorOpen}
		bind:edgePullBlank={previewEdgeBlank}
		getMediaSlotRect={readMediaSlotRect}
		onClose={(idx) => {
			activeIndex = idx;
		}}
		{mediaList}
		initialIndex={previewEditorInitialIndex}
		autoplay={previewEditorAutoplay}
		fullScreen={true}
	/>
</div>
