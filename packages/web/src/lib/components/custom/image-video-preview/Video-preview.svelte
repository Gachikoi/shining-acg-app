<script lang="ts">
	/**
	 * ImageVideoPreview 子组件：当前索引对应视频的播放界面（控制条、倍速、全屏、音量等）。
	 * 媒体节点通过 `bind:videoElement` / `bind:videoContainer` 交给父组件统一处理手势与自动播放策略。
	 */
	import type { V1MediaAsset as Media } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { Play, Volume2, VolumeX, Maximize, Minimize, Download } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { getMediaDisplayUrl } from '$lib/media-url';
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';

	let {
		mediaList = [] as Media[],
		currentIndex = 0,
		currentMedia = null,
		isVideoPlaying = false,
		isVideoBuffering = false,
		isFullscreen = false,
		isMobile = false,
		showControls = true,
		playbackRate = 1,
		videoProgress = 0,
		videoDuration = 0,
		volume = 1,
		isMuted = false,
		playbackRatePopoverOpen = false,
		handleVideoPlay = () => {},
		handleVideoPause = () => {},
		handleVideoTimeUpdate = () => {},
		handleVideoLoadedMetadata = () => {},
		togglePlay = () => {},
		handleControlsClick = () => {},
		handleProgressChange = () => {},
		handleProgressMouseDown = () => {},
		handleProgressMouseUp = () => {},
		toggleMute = () => {},
		handleVolumeChange = () => {},
		changePlaybackRate = () => {},
		toggleFullscreen = () => {},
		onDownloadClick = () => {},
		handleContextMenu,
		controlsEl = $bindable(null),
		videoElement = $bindable(null),
		videoContainer = $bindable(null)
	}: {
		mediaList?: Media[];
		currentIndex?: number;
		currentMedia?: Media | null;
		isVideoPlaying?: boolean;
		isVideoBuffering?: boolean;
		isFullscreen?: boolean;
		isMobile?: boolean;
		showControls?: boolean;
		playbackRate?: number;
		videoProgress?: number;
		videoDuration?: number;
		volume?: number;
		isMuted?: boolean;
		playbackRatePopoverOpen?: boolean;
		handleVideoPlay?: () => void;
		handleVideoPause?: () => void;
		handleVideoTimeUpdate?: () => void;
		handleVideoLoadedMetadata?: () => void;
		togglePlay?: () => void;
		handleControlsClick?: (event: MouseEvent) => void;
		handleProgressChange?: (event: Event) => void;
		handleProgressMouseDown?: () => void;
		handleProgressMouseUp?: () => void;
		toggleMute?: () => void;
		handleVolumeChange?: (event: Event) => void;
		changePlaybackRate?: (rate: number) => void;
		toggleFullscreen?: () => void;
		onDownloadClick?: (e: MouseEvent) => void;
		handleContextMenu?: (event: MouseEvent) => void;
		controlsEl?: HTMLDivElement | null;
		videoElement?: HTMLVideoElement | null;
		videoContainer?: HTMLDivElement | null;
	} = $props();
</script>

<div
	bind:this={videoContainer}
	class={cn(
		'relative flex items-center justify-center overflow-hidden',
		// 使用浏览器 Fullscreen API 后，容器会自动铺满屏幕；这里仅做普通布局样式
		'h-full w-full'
	)}
>
	<div
		class="flex h-full w-full transition-transform duration-300 ease-out"
		style={`transform: translateX(-${currentIndex * 100}%);`}
	>
		{#each mediaList as media, index (media.assetId ?? index)}
			{#if index === currentIndex || index === currentIndex - 1 || index === currentIndex + 1 || mediaList.length <= 3}
				<div class="relative flex h-full w-full flex-[0_0_100%] items-center justify-center">
					{#if index === currentIndex}
						<video
							bind:this={videoElement}
							src={getMediaDisplayUrl(media)}
							class={cn(isFullscreen ? 'h-full w-full object-contain' : 'max-h-full max-w-full')}
							onplay={handleVideoPlay}
							onpause={handleVideoPause}
							ontimeupdate={handleVideoTimeUpdate}
							onloadedmetadata={handleVideoLoadedMetadata}
							oncontextmenu={handleContextMenu}
							playsinline
						>
							<track kind="captions" />
						</video>
					{:else}
						<video
							src={getMediaDisplayUrl(media)}
							preload="none"
							class={cn(isFullscreen ? 'h-full w-full object-contain' : 'max-h-full max-w-full')}
							oncontextmenu={handleContextMenu}
							playsinline
						>
							<track kind="captions" />
						</video>
					{/if}

					<!-- 播放按钮（暂停时显示，仅当前视频） -->
					{#if index === currentIndex && !isVideoPlaying}
						<button
							type="button"
							class={cn(
								'play-button-area absolute inset-0 flex cursor-pointer items-center justify-center bg-black/20',
								isFullscreen ? 'z-65' : 'z-10'
							)}
							onclick={(e) => {
								e.stopPropagation();
								togglePlay();
							}}
							aria-label="播放视频"
						>
							<Button
								variant="ghost"
								size="icon"
								class="min-h-16 min-w-16 rounded-full bg-black/50 text-white hover:bg-black/70"
							>
								<Play class="size-8" />
							</Button>
						</button>
					{/if}

					<!-- Loading：卡顿/缓冲时显示（仅当前视频） -->
					{#if index === currentIndex && isVideoBuffering}
						<div
							class={cn(
								'pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20',
								isFullscreen ? 'z-70' : 'z-20'
							)}
							role="status"
							aria-live="polite"
						>
							<div
								class="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"
							></div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center"></div>
			{/if}
		{/each}
	</div>

	<!-- 视频控制界面（可自动隐藏） -->
	{#if currentMedia?.type === 'MEDIA_TYPE_VIDEO' && showControls}
		<div
			bind:this={controlsEl}
			role="toolbar"
			tabindex="-1"
			class={cn(
				'video-controls absolute right-0 bottom-0 left-0 w-full px-3 pb-3 transition-opacity duration-300',
				isFullscreen ? 'z-70' : 'z-20'
			)}
			onclick={handleControlsClick}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div
				class="flex w-full flex-col gap-2 rounded-2xl bg-white/90 px-3 py-2.5 text-zinc-900 shadow-lg backdrop-blur-sm transition-colors dark:bg-zinc-900/90 dark:text-zinc-100"
			>
				<!-- 上：进度条（移动端占满预览宽度；缩小滑动条高度） -->
				<input
					type="range"
					min="0"
					max="1"
					step="0.001"
					value={videoProgress}
					class="h-0.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-300 accent-zinc-900 dark:bg-zinc-600 dark:accent-zinc-100"
					style={`background: linear-gradient(to right, rgb(161 161 170) 0%, rgb(161 161 170) ${Math.max(
						0,
						Math.min(100, videoProgress * 100)
					)}%, rgb(39 39 42) ${Math.max(0, Math.min(100, videoProgress * 100))}%, rgb(39 39 42) 100%);`}
					oninput={handleProgressChange}
					onmousedown={handleProgressMouseDown}
					onmouseup={handleProgressMouseUp}
				/>

				<!-- 下：左下角时间 / 右下角倍速+下载（PC 端额外提供音量/全屏） -->
				<div class="flex items-end justify-between gap-3">
					<div class={cn('cursor-text font-medium tabular-nums', isMobile ? 'text-xs' : 'text-sm')}>
						{#if Number.isFinite(videoDuration) && videoDuration > 0}
							{Math.floor((videoProgress * videoDuration) / 60)}:{Math.floor(
								(videoProgress * videoDuration) % 60
							)
								.toString()
								.padStart(2, '0')}/{Math.floor(videoDuration / 60)}:{Math.floor(videoDuration % 60)
								.toString()
								.padStart(2, '0')}
						{:else}
							0:00/0:00
						{/if}
					</div>

					<div class="flex items-center gap-2">
						<!-- 倍速（文字样式） -->
						<Popover bind:open={playbackRatePopoverOpen}>
							<PopoverTrigger
								class={cn(
									'font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300',
									isMobile ? 'text-xs' : 'text-sm'
								)}
							>
								<span>倍速 {playbackRate}x</span>
							</PopoverTrigger>
							<PopoverContent
								class="z-100 mb-2 w-32 bg-zinc-900/95 p-1"
								portalProps={{ disabled: isFullscreen }}
								side="top"
								sideOffset={8}
								align="end"
							>
								<div class="flex flex-col gap-1">
									{#each [0.5, 1, 1.5, 2] as rate (rate)}
										<Button
											variant={playbackRate === rate ? 'default' : 'ghost'}
											size="sm"
											class={cn(
												'w-full justify-start text-xs',
												playbackRate === rate
													? 'bg-white text-black'
													: 'text-white hover:bg-white/20'
											)}
											onclick={(e) => {
												e.stopPropagation();
												changePlaybackRate(rate);
											}}
										>
											{rate}x
										</Button>
									{/each}
								</div>
							</PopoverContent>
						</Popover>

						<!-- 下载按钮（双端都显示：直接下载当前视频） -->
						<Button
							variant="ghost"
							size="icon"
							class="min-h-9 min-w-9 rounded-full text-zinc-900 hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-700"
							aria-label="下载"
							onclick={(e) => {
								e.stopPropagation();
								onDownloadClick(e);
							}}
						>
							<Download class="size-5" />
						</Button>

						<!-- 音量 + 全屏仅 PC -->
						{#if !isMobile}
							<div class="flex items-center gap-2">
								<Button
									variant="ghost"
									size="icon"
									class="min-h-9 min-w-9 rounded-full text-zinc-900 hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-700"
									onclick={(e) => {
										e.stopPropagation();
										toggleMute();
									}}
								>
									{#if isMuted || volume === 0}
										<VolumeX class="size-5" />
									{:else}
										<Volume2 class="size-5" />
									{/if}
								</Button>
								<input
									type="range"
									min="0"
									max="1"
									step="0.05"
									value={volume}
									class="h-0.5 w-16 cursor-pointer appearance-none rounded-full bg-zinc-300 accent-zinc-900 dark:bg-zinc-600 dark:accent-zinc-100"
									oninput={(e) => {
										e.stopPropagation();
										handleVolumeChange(e);
									}}
								/>
								<Button
									variant="ghost"
									size="icon"
									class="min-h-9 min-w-9 rounded-full text-zinc-900 hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-700"
									onclick={(e) => {
										e.stopPropagation();
										toggleFullscreen();
									}}
								>
									{#if isFullscreen}
										<Minimize class="size-5" />
									{:else}
										<Maximize class="size-5" />
									{/if}
								</Button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
