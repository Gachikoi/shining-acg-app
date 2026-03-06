<script lang="ts">
	import type { V1MediaAsset as Media } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-svelte';
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
		handleContextMenu,
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
		handleContextMenu?: (event: MouseEvent) => void;
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
		{#each mediaList as media, index (media.asset_id ?? index)}
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
			role="toolbar"
			tabindex="-1"
			class={cn(
				'video-controls absolute bottom-4 left-1/2 w-[calc(100%-3rem)] max-w-5xl -translate-x-1/2 transition-opacity duration-300',
				isFullscreen ? 'z-70' : 'z-20'
			)}
			onclick={handleControlsClick}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div
				class="flex items-center justify-between gap-4 rounded-[40px] bg-white/90 px-4 py-3 text-zinc-900 shadow-lg backdrop-blur-sm transition-colors dark:bg-zinc-900/90 dark:text-zinc-100"
			>
				<!-- 左侧：播放按钮 + 时间（当前/总时长） -->
				<div class="flex items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						class="min-h-10 min-w-10 rounded-full text-zinc-900 hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-700"
						onclick={(e) => {
							e.stopPropagation();
							togglePlay();
						}}
					>
						{#if isVideoPlaying}
							<Pause class="size-5" />
						{:else}
							<Play class="size-5" />
						{/if}
					</Button>
					{#if Number.isFinite(videoDuration) && videoDuration > 0}
						<div class="cursor-text text-sm font-medium">
							{Math.floor((videoProgress * videoDuration) / 60)}:{Math.floor(
								(videoProgress * videoDuration) % 60
							)
								.toString()
								.padStart(2, '0')}/{Math.floor(videoDuration / 60)}:{Math.floor(videoDuration % 60)
								.toString()
								.padStart(2, '0')}
						</div>
					{:else}
						<div class="cursor-text text-sm font-medium">0:00/0:00</div>
					{/if}
				</div>

				<!-- 中间：进度条 -->
				<div class="flex-1 px-4">
					<input
						type="range"
						min="0"
						max="1"
						step="0.001"
						value={videoProgress}
						class="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-300 accent-zinc-900 dark:bg-zinc-600 dark:accent-zinc-100"
						oninput={handleProgressChange}
						onmousedown={handleProgressMouseDown}
						onmouseup={handleProgressMouseUp}
					/>
				</div>

				<!-- 右侧：倍速 / 音量 / 全屏 -->
				<div class="flex items-center gap-3">
					<!-- 倍速（文字样式） -->
					<Popover bind:open={playbackRatePopoverOpen}>
						<PopoverTrigger
							class="text-sm font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
						>
							<span>倍速 {playbackRate}x</span>
						</PopoverTrigger>
						<PopoverContent
							class="z-100 mb-2 w-32 bg-zinc-900/95 p-1"
							portalProps={{ disabled: isFullscreen }}
							side="top"
							sideOffset={8}
							align="center"
						>
							<div class="flex flex-col gap-1">
								{#each [0.5, 1, 1.5, 2] as rate (rate)}
									<Button
										variant={playbackRate === rate ? 'default' : 'ghost'}
										size="sm"
										class={cn(
											'w-full justify-start text-xs',
											playbackRate === rate ? 'bg-white text-black' : 'text-white hover:bg-white/20'
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

					<!-- 音量（PC 端：图标 + 音量条；移动端不展示） -->
					{#if !isMobile}
						<div class="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								class="min-h-10 min-w-10 rounded-full text-zinc-900 hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-700"
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
								class="h-1 w-20 cursor-pointer appearance-none rounded-full bg-zinc-300 accent-zinc-900 dark:bg-zinc-600 dark:accent-zinc-100"
								oninput={(e) => {
									e.stopPropagation();
									handleVolumeChange(e);
								}}
							/>
						</div>
					{/if}

					<!-- 全屏按钮（仅PC端显示） -->
					{#if !isMobile}
						<Button
							variant="ghost"
							size="icon"
							class="min-h-10 min-w-10 rounded-full text-zinc-900 hover:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-700"
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
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
