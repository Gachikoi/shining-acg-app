<script lang="ts">
	/**
	 * @component
	 * ## ImageVideoPreview - 图片/视频预览器
	 *
	 * 全屏预览组件，实现图片和视频的查看、切换、控制等功能。常用于帖子详情中的媒体预览。
	 *
	 * ### 功能特性
	 *
	 * - **图片预览**：支持双击填满屏幕、左右按钮切换
	 * - **视频预览**：支持播放/暂停、进度拖拽、音量调节、倍速播放、全屏、自动隐藏控制条
	 * - **下载功能**：支持单图/视频下载、批量下载（右击菜单）
	 * - **响应式适配**：自动检测移动端设备，适配不同交互方式
	 * - **键盘支持**：支持 ArrowLeft/ArrowRight 切换，Space/K 播放/暂停，Escape 关闭
	 * - **懒加载优化**：只渲染当前及相邻媒体，非当前视频使用 preload="none"
	 *
	 * ### 使用方式
	 *
	 * ```svelte
	 * let open = $state(false);
	 * let mediaList = $state([
	 *   { type: 'MEDIA_TYPE_IMAGE', single: { url: 'xxx.jpg' } },
	 *   { type: 'MEDIA_TYPE_VIDEO', single: { url: 'xxx.mp4' } }
	 * ] as V1MediaAsset[]);
	 *
	 * <ImageVideoPreview
	 *   bind:open
	 *   {mediaList}
	 *   initialIndex={0}
	 *   autoplay={false}
	 *   fullScreen={true}
	 * />
	 * ```
	 *
	 * ### Props
	 *
	 * | 属性 | 类型 | 默认值 | 说明 |
	 * |------|------|--------|------|
	 * | open | boolean | false | 控制预览框显示/隐藏（bindable） |
	 * | mediaList | V1MediaAsset[] | [] | 媒体资产列表 |
	 * | initialIndex | number | 0 | 初始显示的媒体索引 |
	 * | autoplay | boolean | false | 视频是否自动播放 |
	 * | fullScreen | boolean | true | 是否全屏显示 |
	 * | class | string | '' | 自定义样式类 |
	 *
	 * ### 热区扩充说明
	 *
	 * 可点击事物（如按钮）的最小可触控区域为 44x44px，已通过 min-h-* / min-w-* 实现热区扩充。
	 */
	import { Button } from '$lib/components/ui/button';
	import type { V1MediaAsset as Media } from '$lib/api';
	import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Download } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import { getMediaDisplayUrl } from '$lib/media-url';
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
	import { isMobileUA } from '$lib/utils/device';
	let {
		open = $bindable(false),
		mediaList = [] as Media[],
		initialIndex = 0,
		autoplay = false,
		fullScreen = true,
		class: className = ''
	}: {
		open?: boolean;
		mediaList?: Media[];
		initialIndex?: number;
		autoplay?: boolean;
		fullScreen?: boolean;
		class?: string;
	} = $props();

	// 检测移动端设备（通过 UA）
	const isMobile = $derived.by(() => isMobileUA());

	// 当前显示的媒体索引
	let currentIndex = $state(0);
	// 图片是否填充满屏幕
	let isImageFilled = $state(false);
	// 视频播放状态
	let isVideoPlaying = $state(false);
	// 视频播放速度
	let playbackRate = $state(1);
	// 视频音量
	let volume = $state(1);
	// 视频是否静音
	let isMuted = $state(false);
	// 视频控制界面是否显示（可自动隐藏）
	let showControls = $state(true);
	// 控制条自动隐藏定时器
	let controlsHideTimer: ReturnType<typeof setTimeout> | null = null;
	// 自动播放是否已经消费（每次打开只尝试一次）
	let autoplayConsumed = $state(false);
	// 双击定时器
	let doubleClickTimer: ReturnType<typeof setTimeout> | null = null;
	// 上次点击时间
	let lastClickTime = 0;
	// 视频元素引用
	let videoElement: HTMLVideoElement | null = $state(null);
	// 视频进度
	let videoProgress = $state(0);
	// 视频时长
	let videoDuration = $state(0);
	// 是否全屏
	let isFullscreen = $state(false);
	// 视频容器（用于调用浏览器 Fullscreen API）
	let videoContainer: HTMLDivElement | null = $state(null);
	// 视频是否正在调整进度
	let isSeeking = $state(false);
	// 下载 popover 状态
	let downloadPopoverOpen = $state(false);
	// 右键菜单位置
	let contextMenuPosition = $state<{ x: number; y: number } | null>(null);
	// 倍速选择 popover 状态
	let playbackRatePopoverOpen = $state(false);
	// 下载错误提示状态
	let downloadError = $state<string | null>(null);
	// 下载错误显示定时器
	let downloadErrorTimer: ReturnType<typeof setTimeout> | null = null;

	// 当前媒体
	const currentMedia = $derived(
		mediaList.length > 0 && currentIndex >= 0 && currentIndex < mediaList.length
			? mediaList[currentIndex]
			: null
	);
	const isImage = $derived(currentMedia?.type === 'MEDIA_TYPE_IMAGE');
	const isVideo = $derived(currentMedia?.type === 'MEDIA_TYPE_VIDEO');

	// 控制条自动隐藏逻辑
	function startControlsHideTimer() {
		stopControlsHideTimer();
		if (isVideoPlaying) {
			controlsHideTimer = setTimeout(() => {
				showControls = false;
			}, 3000);
		}
	}

	function stopControlsHideTimer() {
		if (controlsHideTimer) {
			clearTimeout(controlsHideTimer);
			controlsHideTimer = null;
		}
	}

	function showControlsTemporarily() {
		showControls = true;
		startControlsHideTimer();
	}

	// 显示下载错误提示
	function showDownloadError(message: string) {
		downloadError = message;
		// 3秒后自动隐藏错误提示
		if (downloadErrorTimer) {
			clearTimeout(downloadErrorTimer);
		}
		downloadErrorTimer = setTimeout(() => {
			downloadError = null;
		}, 3000);
	}

	// 监听 initialIndex 变化
	$effect(() => {
		if (open && initialIndex >= 0 && initialIndex < mediaList.length) {
			currentIndex = initialIndex;
		}
	});

	// 监听 open 变化，重置状态
	$effect(() => {
		if (open) {
			isImageFilled = false;
			isVideoPlaying = false;
			playbackRate = 1;
			showControls = true;
			autoplayConsumed = false;
			stopControlsHideTimer();
		} else {
			// 关闭时清理定时器
			stopControlsHideTimer();
			// 关闭时退出全屏（如果仍处于全屏）
			if (
				typeof document !== 'undefined' &&
				document.fullscreenElement &&
				document.fullscreenElement === videoContainer
			) {
				document.exitFullscreen?.().catch(() => {});
			}
			// 关闭时暂停视频
			if (videoElement) {
				videoElement.pause();
				videoElement.currentTime = 0;
			}
			// 关闭下载菜单
			downloadPopoverOpen = false;
			contextMenuPosition = null;
		}
	});

	// 打开预览后，如需自动播放则尝试开始播放（需由用户点击触发打开，浏览器才允许）
	$effect(() => {
		if (!open) return;
		if (!autoplay) return;
		if (autoplayConsumed) return;
		if (!isVideo) return;
		if (!videoElement) return;

		autoplayConsumed = true;
		showControls = true;
		videoElement
			.play()
			.then(() => {
				isVideoPlaying = true;
				startControlsHideTimer();
			})
			.catch(() => {
				// 部分浏览器/场景会阻止自动播放；保持为暂停态并显示控件即可
				isVideoPlaying = false;
			});
	});

	// 切换上一张/下一张
	function prevMedia() {
		if (mediaList.length <= 1) {
			handleClose();
			return;
		}
		if (currentIndex > 0) {
			currentIndex = currentIndex - 1;
		} else {
			handleClose();
		}
		resetVideo();
	}

	function nextMedia() {
		if (mediaList.length <= 1) {
			handleClose();
			return;
		}
		if (currentIndex < mediaList.length - 1) {
			currentIndex = currentIndex + 1;
		} else {
			handleClose();
		}
		resetVideo();
	}

	function resetVideo() {
		if (videoElement) {
			videoElement.pause();
			videoElement.currentTime = 0;
			isVideoPlaying = false;
			playbackRate = 1;
			videoElement.playbackRate = 1;
			showControls = true;
		}
	}

	// 处理关闭
	function handleClose() {
		open = false;
	}

	// 处理单击
	function handleClick(event: MouseEvent) {
		// 如果点击的是控制按钮区域，不关闭
		if ((event.target as HTMLElement).closest('.video-controls')) {
			return;
		}

		// 双击检测
		const now = Date.now();
		if (now - lastClickTime < 300) {
			// 双击
			if (doubleClickTimer) {
				clearTimeout(doubleClickTimer);
			}
			handleDoubleClick();
			lastClickTime = 0;
			return;
		}
		lastClickTime = now;

		// 视频暂停时，单击显示控制界面或恢复播放
		if (isVideo && !isVideoPlaying) {
			showControlsTemporarily();
			// 如果点击的是播放按钮区域，则播放
			if ((event.target as HTMLElement).closest('.play-button-area')) {
				togglePlay();
			}
			return;
		}

		// 图片单击关闭
		if (isImage) {
			handleClose();
			return;
		}

		// 视频播放时：
		// - 非全屏：单击关闭（原逻辑）
		// - 全屏：单击仅切换控制条显示，避免误触退出预览/返回详情页
		if (isVideo && isVideoPlaying) {
			if (isFullscreen) {
				showControls = !showControls;
				if (showControls) {
					startControlsHideTimer();
				} else {
					stopControlsHideTimer();
				}
				return;
			}
			handleClose();
		}
	}

	// 处理双击
	function handleDoubleClick() {
		if (isImage) {
			// 图片双击填充满屏幕
			isImageFilled = !isImageFilled;
		} else if (isVideo) {
			// 视频双击暂停/播放
			togglePlay();
		}
	}

	// 视频播放控制
	function togglePlay() {
		if (!videoElement) return;
		if (isVideoPlaying) {
			videoElement.pause();
			isVideoPlaying = false;
			showControlsTemporarily();
		} else {
			videoElement.play();
			isVideoPlaying = true;
			showControlsTemporarily();
		}
	}

	function handleVideoPlay() {
		if (videoElement) {
			videoElement.playbackRate = playbackRate;
		}
		isVideoPlaying = true;
		showControlsTemporarily();
	}

	function handleVideoPause() {
		isVideoPlaying = false;
		showControls = true;
		stopControlsHideTimer();
	}

	function handleVideoTimeUpdate() {
		if (videoElement && !isSeeking) {
			// 避免 videoDuration 还没就绪时出现 0/0 导致 NaN
			if (videoDuration > 0) {
				videoProgress = videoElement.currentTime / videoDuration;
			} else {
				videoProgress = 0;
			}
		}
	}

	function handleVideoLoadedMetadata() {
		if (videoElement) {
			// 元数据就绪后，更新总时长并同步当前进度
			videoDuration = videoElement.duration || 0;
			videoProgress = videoDuration > 0 ? videoElement.currentTime / videoDuration : 0;
			// 应用当前的播放速度
			videoElement.playbackRate = playbackRate;
			// 同步当前音量
			videoElement.volume = volume;
			// 根据视频比例自动切换横竖屏
			if (fullScreen && videoElement.videoWidth && videoElement.videoHeight) {
				// const isPortrait = videoElement.videoHeight > videoElement.videoWidth;
				// 可以在这里添加横竖屏切换逻辑，但浏览器全屏 API 需要用户交互
			}
		}
	}

	function handleProgressChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (videoElement) {
			const newTime = parseFloat(target.value) * videoDuration;
			videoElement.currentTime = newTime;
			videoProgress = parseFloat(target.value);
		}
	}

	function handleProgressMouseDown() {
		isSeeking = true;
	}

	function handleProgressMouseUp() {
		isSeeking = false;
	}

	function toggleMute() {
		if (!videoElement) return;
		isMuted = !isMuted;
		videoElement.muted = isMuted;
	}

	function handleVolumeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		volume = parseFloat(target.value);
		if (videoElement) {
			videoElement.volume = volume;
			isMuted = volume === 0;
		}
	}

	function changePlaybackRate(rate: number) {
		playbackRate = rate;
		if (videoElement) {
			videoElement.playbackRate = rate;
		}
		playbackRatePopoverOpen = false;
	}

	function toggleFullscreen() {
		if (!isVideo) return;
		if (typeof document === 'undefined') return;

		// 移动端优先使用容器全屏，保留自定义 UI
		if (isMobile && videoElement) {
			// iOS Safari 优先尝试容器全屏（保留自定义控件）
			const videoEl = videoElement as HTMLVideoElement & {
				webkitEnterFullscreen?: () => void;
			};

			// 先尝试标准全屏 API
			const containerEl = videoContainer;
			if (containerEl && containerEl.requestFullscreen) {
				containerEl.requestFullscreen().catch(() => {
					// 如果标准 API 失败，回退到 video 元素全屏
					if (videoEl.webkitEnterFullscreen) {
						videoEl.webkitEnterFullscreen();
						isFullscreen = true;
						showControls = true;
					}
				});
				showControls = true;
				return;
			}

			// 回退到 video 元素全屏
			if (videoEl.webkitEnterFullscreen) {
				videoEl.webkitEnterFullscreen();
				isFullscreen = true;
				showControls = true;
				return;
			}
		}

		const el = videoContainer;
		if (!el) return;

		// 若已在全屏，退出；否则对“容器”进入全屏（而非 video），以保留自定义 UI
		if (document.fullscreenElement && document.fullscreenElement === el) {
			document.exitFullscreen?.().catch(() => {});
			return;
		}

		const fullscreenTarget: HTMLElement & {
			webkitRequestFullscreen?: () => Promise<void> | void;
			mozRequestFullScreen?: () => Promise<void> | void;
			msRequestFullscreen?: () => Promise<void> | void;
		} = el;

		const request =
			el.requestFullscreen?.bind(el) ||
			fullscreenTarget.webkitRequestFullscreen?.bind(fullscreenTarget) ||
			fullscreenTarget.mozRequestFullScreen?.bind(fullscreenTarget) ||
			fullscreenTarget.msRequestFullscreen?.bind(fullscreenTarget);

		if (request) {
			Promise.resolve(request()).catch(() => {});
			showControls = true;
		}
	}

	// 监听全局点击、键盘事件，关闭下载菜单和倍速选择菜单
	onMount(() => {
		// 监听全屏变化（ESC/系统退出也会触发），同步 isFullscreen
		const handleFullscreenChange = () => {
			const isFs =
				typeof document !== 'undefined' &&
				!!document.fullscreenElement &&
				document.fullscreenElement === videoContainer;
			isFullscreen = isFs;
			// 退出全屏时，确保控制条仍可见（避免状态错乱）
			showControls = true;
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		const docWithWebkit = document as Document & {
			webkitfullscreenchange?: Event;
			addEventListener?: (type: string, listener: () => void) => void;
			removeEventListener?: (type: string, listener: () => void) => void;
		};
		docWithWebkit.addEventListener?.('webkitfullscreenchange', handleFullscreenChange);

		const handleGlobalClick = (e: MouseEvent) => {
			if (downloadPopoverOpen && !(e.target as HTMLElement).closest('[data-download-menu]')) {
				downloadPopoverOpen = false;
				contextMenuPosition = null;
			}
		};
		document.addEventListener('click', handleGlobalClick);

		// 键盘导航支持
		const handleKeyDown = (e: KeyboardEvent) => {
			// 忽略如果用户在输入框中
			if ((e.target as HTMLElement).closest('input')) return;

			switch (e.key) {
				case 'Escape':
					handleClose();
					break;
				case 'ArrowLeft':
					if (mediaList.length > 1) {
						prevMedia();
					}
					break;
				case 'ArrowRight':
					if (mediaList.length > 1) {
						nextMedia();
					}
					break;
				case ' ':
				case 'k':
					// 空格或 K 键切换播放/暂停
					if (isVideo) {
						e.preventDefault();
						togglePlay();
					}
					break;
			}
		};
		document.addEventListener('keydown', handleKeyDown);

		// 移动端触摸事件：触摸时显示控制条，3秒后隐藏
		const handleTouchStartForControls = () => {
			if (isVideo) {
				showControlsTemporarily();
			}
		};
		// 仅在移动端添加触摸事件监听
		if (isMobile) {
			document.addEventListener('touchstart', handleTouchStartForControls, { passive: true });
		}

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			docWithWebkit.removeEventListener?.('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('click', handleGlobalClick);
			document.removeEventListener('keydown', handleKeyDown);
			if (isMobile) {
				document.removeEventListener('touchstart', handleTouchStartForControls);
			}
		};
	});

	// 视频控制界面点击
	function handleControlsClick(event: MouseEvent) {
		event.stopPropagation();
		showControls = true;
	}

	// 格式化时间
	function formatTime(seconds: number): string {
		// 保护：避免 NaN / Infinity 显示成 "NaN:NaN"
		if (!Number.isFinite(seconds) || seconds <= 0) {
			return '0:00';
		}
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// 下载单个媒体文件
	async function downloadMedia(media: Media): Promise<boolean> {
		// 获取媒体 URL（已适配新媒体资产结构）
		const mediaUrl = getMediaDisplayUrl(media);
		if (!mediaUrl) {
			showDownloadError('下载失败：媒体文件不存在');
			return false;
		}

		// 根据媒体类型设置文件名
		const isMediaImage = media.type === 'MEDIA_TYPE_IMAGE';
		const extension = isMediaImage ? 'jpg' : 'mp4';
		const fileId =
			media.single?.id ??
			media.live_photo?.image?.id ??
			media.live_photo?.video?.id ??
			Date.now().toString();
		const filename = `media_${fileId}.${extension}`;

		// 首先尝试使用 fetch 下载（适用于同源或已配置 CORS 的资源）
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
		try {
			const response = await fetch(mediaUrl, {
				mode: 'cors',
				credentials: 'omit',
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
			return true; // 成功下载
		} catch (fetchError) {
			clearTimeout(timeoutId);
			console.warn('Fetch 下载失败，尝试直接链接下载', fetchError);

			// Fallback: 使用 <a download> 直接链接下载（需同源或服务器支持）
			try {
				const a = document.createElement('a');
				a.href = mediaUrl;
				a.download = filename;
				a.target = '_blank';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				return true;
			} catch (linkError) {
				console.error('直接链接下载也失败', linkError);
				showDownloadError('下载失败，请尝试长按保存');
				return false;
			}
		}
	}

	// 下载当前媒体
	function handleDownloadCurrent() {
		if (currentMedia) {
			downloadMedia(currentMedia).then((success) => {
				if (!success && downloadError) {
					// 显示错误提示（可以后续替换为 Toast）
					console.warn(downloadError);
				}
			});
		}
		downloadPopoverOpen = false;
	}

	// 下载全部媒体
	async function handleDownloadAll() {
		if (mediaList.length === 0) return;

		let failCount = 0;

		for (let i = 0; i < mediaList.length; i++) {
			const media = mediaList[i];
			const success = await downloadMedia(media);
			if (!success) {
				failCount++;
				// 如果失败，提示用户并停止下载
				if (downloadError) {
					console.warn(`第 ${i + 1} 个文件下载失败:`, downloadError);
				}
			}
			// 添加延迟避免浏览器阻止多个下载
			if (i < mediaList.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		if (failCount > 0) {
			showDownloadError(`${failCount} 个文件下载失败`);
		}
		downloadPopoverOpen = false;
	}

	// 处理右键菜单（仅桌面端）
	function handleContextMenu(event: MouseEvent) {
		// 手机端禁用右键菜单
		if (isMobile) {
			event.preventDefault();
			return;
		}
		event.preventDefault();

		// 边界检测：避免菜单超出可视区
		const menuWidth = 192; // w-48 = 12rem = 192px
		const menuHeight = 100; // 估算菜单高度
		const padding = 8; // 边距

		let x = event.clientX;
		let y = event.clientY;

		// 检测右边界
		if (x + menuWidth + padding > window.innerWidth) {
			x = window.innerWidth - menuWidth - padding;
		}
		// 检测下边界
		if (y + menuHeight + padding > window.innerHeight) {
			y = window.innerHeight - menuHeight - padding;
		}

		contextMenuPosition = { x, y };
		downloadPopoverOpen = true;
	}
</script>

{#if open}
	<div
		role="dialog"
		aria-label="图片视频预览"
		tabindex="-1"
		class={cn(
			'fixed z-60 flex flex-col items-center justify-center',
			fullScreen ? 'inset-0 bg-black' : 'inset-0 bg-zinc-100',
			className
		)}
		onclick={(e) => {
			// 如果点击的是下载菜单，不关闭预览
			if ((e.target as HTMLElement).closest('[data-download-menu]')) {
				return;
			}
			// 点击其他地方时关闭下载菜单
			if (downloadPopoverOpen) {
				downloadPopoverOpen = false;
				contextMenuPosition = null;
				return;
			}
			handleClick(e);
		}}
		onkeydown={(e) => {
			// 阻止键盘事件冒泡，避免影响全局键盘监听
			e.stopPropagation();
		}}
	>
		<!-- 关闭按钮 -->
		<div class={cn('absolute top-4 left-4', isVideo && isFullscreen ? 'z-70' : 'z-10')}>
			<Button
				variant="ghost"
				size="icon"
				class="min-h-11 min-w-11 text-white hover:bg-white/20"
				onclick={handleClose}
				aria-label="关闭"
			>
				<X class="size-5" />
			</Button>
		</div>

		<!-- 媒体内容 -->
		{#if currentMedia}
			<div class="group relative flex h-full w-full items-center justify-center overflow-hidden">
				{#if isImage}
					<!-- 图片 -->
					<div class="relative flex h-full w-full items-center justify-center">
						<div
							class="flex h-full w-full transition-transform duration-300 ease-out"
							style={`transform: translateX(-${currentIndex * 100}%);`}
						>
							{#each mediaList as media, index (media.item_id ?? index)}
								{#if index === currentIndex || index === currentIndex - 1 || index === currentIndex + 1}
									<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center">
										<img
											src={getMediaDisplayUrl(media)}
											alt="预览图片"
											loading={index === currentIndex ? 'eager' : 'lazy'}
											class={cn(
												'max-h-full max-w-full object-contain transition-all duration-300',
												index === currentIndex && isImageFilled && 'h-full w-full object-cover'
											)}
											oncontextmenu={handleContextMenu}
										/>
									</div>
								{:else}
									<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center"></div>
								{/if}
							{/each}
						</div>
					</div>
				{:else if isVideo}
					<!-- 视频 -->
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
							{#each mediaList as media, index (media.item_id ?? index)}
								{#if index === currentIndex || index === currentIndex - 1 || index === currentIndex + 1}
									<div
										class="relative flex h-full w-full flex-[0_0_100%] items-center justify-center"
									>
										{#if index === currentIndex}
											<video
												bind:this={videoElement}
												src={getMediaDisplayUrl(media)}
												class={cn(
													isFullscreen ? 'h-full w-full object-contain' : 'max-h-full max-w-full'
												)}
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
												class={cn(
													isFullscreen ? 'h-full w-full object-contain' : 'max-h-full max-w-full'
												)}
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
									</div>
								{:else}
									<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center"></div>
								{/if}
							{/each}
						</div>

						<!-- 视频控制界面（可自动隐藏） -->
						{#if isVideo && currentMedia?.type === 'MEDIA_TYPE_VIDEO' && showControls}
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
										<div class="text-sm font-medium">
											{formatTime(videoProgress * videoDuration)}/{formatTime(videoDuration)}
										</div>
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
				{/if}

				<!-- 左右切换按钮（仅在有多张媒体时显示，且非视频全屏状态） -->
				{#if mediaList.length > 1 && !(isVideo && isFullscreen)}
					<!-- 上一张 -->
					<button
						class={cn(
							'absolute top-1/2 left-4 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-white transition-all hover:scale-110 hover:bg-black/60',
							'opacity-60 group-hover:opacity-100',
							currentIndex === 0 &&
								!(isVideo && isVideoPlaying) &&
								'cursor-not-allowed opacity-30 hover:scale-100'
						)}
						onclick={(e) => {
							e.stopPropagation();
							if (currentIndex > 0 || (isVideo && isVideoPlaying)) {
								prevMedia();
							}
						}}
						aria-label="上一张"
						type="button"
						disabled={currentIndex === 0 && !(isVideo && isVideoPlaying)}
					>
						<svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>

					<!-- 下一张 -->
					<button
						class={cn(
							'absolute top-1/2 right-4 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-white transition-all hover:scale-110 hover:bg-black/60',
							'opacity-60 group-hover:opacity-100',
							currentIndex === mediaList.length - 1 &&
								!(isVideo && isVideoPlaying) &&
								'cursor-not-allowed opacity-30 hover:scale-100'
						)}
						onclick={(e) => {
							e.stopPropagation();
							if (currentIndex < mediaList.length - 1 || (isVideo && isVideoPlaying)) {
								nextMedia();
							}
						}}
						aria-label="下一张"
						type="button"
						disabled={currentIndex === mediaList.length - 1 && !(isVideo && isVideoPlaying)}
					>
						<svg class="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>

					<!-- 右上角页码 -->
					<div
						class="absolute top-4 right-4 z-10 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white opacity-60 transition-opacity group-hover:opacity-100"
					>
						{currentIndex + 1} / {mediaList.length}
					</div>

					<!-- 底部小圆点指示器 -->
					<div
						class="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 opacity-60 transition-opacity group-hover:opacity-100"
					>
						<div class="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5">
							<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
							{#each Array.from({ length: mediaList.length }) as _unused, index (index)}
								<button
									type="button"
									class={cn(
										'h-2 w-2 cursor-pointer rounded-full transition-colors',
										index === currentIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/75'
									)}
									onclick={(e) => {
										e.stopPropagation();
										currentIndex = index;
										resetVideo();
									}}
									aria-label={`查看第 ${index + 1} 张媒体`}
								></button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col items-center gap-4 px-6 text-center">
				<p class="text-zinc-400">暂无媒体内容</p>
			</div>
		{/if}
	</div>

	<!-- 下载菜单 -->
	{#if downloadPopoverOpen && contextMenuPosition}
		<div
			data-download-menu
			role="menu"
			tabindex="-1"
			class="fixed z-70 w-48 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
			style={`left: ${contextMenuPosition.x}px; top: ${contextMenuPosition.y}px;`}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="flex flex-col gap-1" role="menuitem">
				<Button variant="ghost" class="w-full justify-start gap-2" onclick={handleDownloadCurrent}>
					<Download class="size-4" />
					{isImage ? '保存图片' : '保存视频'}
				</Button>
				<Button variant="ghost" class="w-full justify-start gap-2" onclick={handleDownloadAll}>
					<Download class="size-4" />
					全部保存
				</Button>
			</div>
		</div>
	{/if}

	<!-- 下载错误提示 -->
	{#if downloadError}
		<div
			class="fixed bottom-20 left-1/2 z-70 -translate-x-1/2 rounded-lg bg-red-500 px-4 py-2 text-sm text-white shadow-lg"
		>
			{downloadError}
		</div>
	{/if}
{/if}
