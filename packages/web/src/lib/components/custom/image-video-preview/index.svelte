<script lang="ts">
	/**
	 * @component
	 * ## ImageVideoPreview - 图片/视频预览器（父组件）
	 *
	 * 拆分为父子组件结构：
	 * - index.svelte：父组件，负责公共逻辑（切换、下载、键盘事件、页码指示器、手势等）
	 * - Image-preview.svelte：图片预览子组件
	 * - Video-preview.svelte：视频预览子组件
	 */
	import { Button } from '$lib/components/ui/button';
	import type { V1MediaAsset as Media } from '$lib/api';
	import { X, Download } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { getMediaDisplayUrl } from '$lib/media-url';
	import { isMobileUA } from '$lib/utils/device';
	import { swipe, tap, longPress, GestureType } from '$lib/modules/gesture';
	import ImagePreview from './Image-preview.svelte';
	import VideoPreview from './Video-preview.svelte';

	let {
		open = $bindable(false),
		mediaList = [] as Media[],
		initialIndex = 0,
		autoplay = true,
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
	// 视频元素引用（由子组件绑定）
	let videoElement: HTMLVideoElement | null = $state(null);
	// 视频进度
	let videoProgress = $state(0);
	// 视频时长
	let videoDuration = $state(0);
	// 视频是否全屏
	let isFullscreen = $state(false);
	// 视频容器（用于调用浏览器 Fullscreen API，由子组件绑定）
	let videoContainer: HTMLDivElement | null = $state(null);
	// 视频是否正在调整进度
	let isSeeking = $state(false);
	// 视频缓冲/卡顿中（用于 loading 动画）
	let isVideoBuffering = $state(false);
	// 统一管理 play() 请求，避免 play/pause 竞态导致 AbortError
	let playRequestSeq = 0;
	let lastAutoplayKey: string | null = null;
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
	// 横向拖拽跟随（swipe 驱动）
	let panOffsetX = $state(0);
	let isPanning = $state(false);
	let gestureContainerEl: HTMLElement | null = $state(null);
	let lastPanEndTime = 0;
	// 刚打开预览后一段时间内忽略关闭（避免移动端「打开」触发的合成 click 落在预览层上误关）
	let lastOpenedAt = 0;
	const TAP_IGNORE_AFTER_OPEN_MS = 420;
	const TAP_IGNORE_AFTER_PAN_MS = 380;
	const TAP_PAUSE_IGNORE_PLAY_MS = 220;
	const PAN_MAX_OFFSET_RATIO = 1.2;
	// 轻击暂停后短时间忽略播放（避免同一次触摸的合成 click 触发播放按钮）
	let lastPausedByTapTime = 0;
	// 长按边缘 2x 倍速：松手恢复 1x，并显示提示
	let isEdgeTwoSpeedActive = $state(false);
	// 刚关闭下载菜单后的短时间，避免随后触发的合成 click 误关预览（仅图片模式）
	let lastDownloadMenuClosedAt = 0;
	const DOWNLOAD_MENU_CLOSED_GRACE_MS = 450;

	// 当前媒体
	const currentMedia = $derived(
		mediaList.length > 0 && currentIndex >= 0 && currentIndex < mediaList.length
			? mediaList[currentIndex]
			: null
	);
	const isImage = $derived(currentMedia?.type === 'MEDIA_TYPE_IMAGE');
	const isVideo = $derived(currentMedia?.type === 'MEDIA_TYPE_VIDEO');

	// 控制条不再自动隐藏（已取消自动隐藏功能）
	function stopControlsHideTimer() {
		if (controlsHideTimer) {
			clearTimeout(controlsHideTimer);
			controlsHideTimer = null;
		}
	}

	function showControlsTemporarily() {
		showControls = true;
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
			lastOpenedAt = Date.now();
			isVideoPlaying = false;
			lastAutoplayKey = null;
			playbackRate = 1;
			showControls = true;
			panOffsetX = 0;
			isPanning = false;
			isVideoBuffering = false;
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
				playRequestSeq++;
				videoElement.pause();
				videoElement.currentTime = 0;
			}
			isVideoBuffering = false;
			// 关闭下载菜单
			downloadPopoverOpen = false;
			contextMenuPosition = null;
			isEdgeTwoSpeedActive = false;
			downloadError = null;
			if (downloadErrorTimer) {
				clearTimeout(downloadErrorTimer);
				downloadErrorTimer = null;
			}
		}
	});

	async function requestPlay() {
		if (!open) return;
		if (!isVideo) return;
		if (!videoElement) return;
		// 若菜单还开着，不在此处自动关菜单；由调用方按交互规则处理
		const seq = ++playRequestSeq;
		try {
			const p = videoElement.play();
			if (p && typeof (p as Promise<void>).then === 'function') {
				await p;
			}
		} catch {
			// 常见：NotAllowedError（自动播放被阻止）/ AbortError（被 pause 打断）
			// 这里不向外抛，保持 UI 为暂停态即可
			if (seq !== playRequestSeq) return;
		}
	}

	function requestPause() {
		if (!videoElement) return;
		playRequestSeq++;
		try {
			videoElement.pause();
		} catch {
			// ignore
		}
		isVideoBuffering = false;
		// 暂停时关闭下载菜单，避免“点别处暂停但菜单仍开着”
		downloadPopoverOpen = false;
		contextMenuPosition = null;
	}

	// 进入视频预览（滑动切换进入 or 直接打开就是视频）时自动尝试播放一次
	$effect(() => {
		if (!open) return;
		if (!autoplay) return;
		if (!isVideo) return;
		if (!videoElement) return;
		// 每次切换进入某个视频时，自动播放只尝试一次（避免重复触发）
		const key = `${currentMedia?.assetId ?? currentIndex}`;
		if (lastAutoplayKey === key) return;
		lastAutoplayKey = key;
		showControls = true;
		requestPlay();
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
			requestPause();
			videoElement.currentTime = 0;
			playbackRate = 1;
			videoElement.playbackRate = 1;
			showControls = true;
			isVideoBuffering = false;
		}
	}

	// 处理关闭
	function handleClose() {
		open = false;
	}

	function openDownloadMenuAtPoint(x: number, y: number) {
		const menuWidth = 192; // w-48 = 12rem = 192px
		const menuHeight = 100; // 估算菜单高度
		const padding = 8; // 边距

		let adjustedX = x;
		let adjustedY = y;

		// 检测右边界
		if (adjustedX + menuWidth + padding > window.innerWidth) {
			adjustedX = window.innerWidth - menuWidth - padding;
		}
		// 检测下边界
		if (adjustedY + menuHeight + padding > window.innerHeight) {
			adjustedY = window.innerHeight - menuHeight - padding;
		}

		contextMenuPosition = { x: adjustedX, y: adjustedY };
		downloadPopoverOpen = true;
	}

	// 统一轻击逻辑（含 PC click / 移动端 tap）：
	// - 点下载菜单不触发其它动作
	// - 点视频控制区/播放按钮交给控件自身处理
	// - 视频：播放态轻击暂停；暂停态轻击播放；若下载菜单打开，轻击菜单外关闭菜单并播放
	// - 图片：轻击关闭预览（下载菜单打开则仅关闭菜单）
	function handleContentTap(target: EventTarget | null) {
		const el = target as HTMLElement;
		if (el?.closest('[data-download-menu]')) return;
		if (el?.closest('.video-controls')) return;
		if (el?.closest('.play-button-area')) return;
		// 点击小圆点/左右切换按钮等导航区只切换内容，不关闭预览
		if (el?.closest('[data-preview-nav]')) return;
		if (downloadPopoverOpen) {
			downloadPopoverOpen = false;
			contextMenuPosition = null;
			lastDownloadMenuClosedAt = Date.now();
			// 需求：有下载菜单时，轻击菜单外 -> 关闭菜单并进入播放状态（仅视频）
			if (isVideo) {
				lastPausedByTapTime = 0;
				requestPlay();
			}
			return;
		}
		// 视频：轻击切换播放/暂停（不关闭预览）
		if (isVideo) {
			if (isVideoPlaying) {
				lastPausedByTapTime = Date.now();
				requestPause();
				showControlsTemporarily();
			} else {
				if (Date.now() - lastPausedByTapTime < TAP_PAUSE_IGNORE_PLAY_MS) {
					lastPausedByTapTime = 0;
					return;
				}
				requestPlay();
				showControlsTemporarily();
			}
			return;
		}
		// 图片：刚关闭下载菜单后的短时间不关预览，避免合成 click 误关
		if (Date.now() - lastDownloadMenuClosedAt < DOWNLOAD_MENU_CLOSED_GRACE_MS) return;
		// 刚打开后忽略：避免移动端「打开」产生的合成 click 落在预览层上误关
		if (Date.now() - lastOpenedAt < TAP_IGNORE_AFTER_OPEN_MS) return;
		handleClose();
	}

	// 同一元素上 swipe + tap + long-press，用手势锁区分竞态
	const swipeOptions = $derived.by(() => ({
		gestureType: GestureType.PREVIEW_SWIPE,
		onSwipeStart() {
			isPanning = true;
		},
		onSwipeMove(deltaX: number) {
			const w = gestureContainerEl?.getBoundingClientRect?.().width ?? 400;
			const max = w * PAN_MAX_OFFSET_RATIO;
			panOffsetX = Math.max(-max, Math.min(max, deltaX));
		},
		onSwipeEnd(direction: 'left' | 'right') {
			if (Math.abs(panOffsetX) >= 10) lastPanEndTime = Date.now();
			isPanning = false;
			if (mediaList.length > 1) {
				if (direction === 'right') prevMedia();
				else nextMedia();
			}
			panOffsetX = 0;
		},
		onSwipeCancel() {
			isPanning = false;
			panOffsetX = 0;
		}
	}));
	const tapOptions = $derived.by(() => ({
		excludeSelector: '.video-controls, .play-button-area, [data-preview-nav]',
		onTap(detail: { target: EventTarget }) {
			if (Date.now() - lastPanEndTime < TAP_IGNORE_AFTER_PAN_MS) return;
			handleContentTap(detail.target);
		}
	}));
	const longPressOptions = $derived.by(() => ({
		gestureType: GestureType.PREVIEW_LONG_PRESS,
		excludeSelector: '.video-controls, .play-button-area',
		touchOnly: true,
		onPress(e: { x: number; clientX: number; clientY: number; currentTarget: HTMLElement }) {
			if (downloadPopoverOpen) return;
			const rect = e.currentTarget.getBoundingClientRect();
			if (isVideo) {
				const xRatio = rect.width > 0 ? e.x / rect.width : 0.5;
				if (xRatio < 0.2 || xRatio > 0.8) {
					isEdgeTwoSpeedActive = true;
					changePlaybackRate(2);
					return;
				}
				requestPause();
				showControls = true;
			}
			openDownloadMenuAtPoint(e.clientX, e.clientY);
		},
		onPressUp() {
			if (isEdgeTwoSpeedActive) {
				isEdgeTwoSpeedActive = false;
				changePlaybackRate(1);
			}
		}
	}));

	// 视频播放控制
	function togglePlay() {
		if (isVideoPlaying) {
			requestPause();
			showControlsTemporarily();
		} else {
			if (Date.now() - lastPausedByTapTime < TAP_PAUSE_IGNORE_PLAY_MS) {
				lastPausedByTapTime = 0;
				return;
			}
			requestPlay();
			showControlsTemporarily();
		}
	}

	function handleVideoPlay() {
		if (videoElement) {
			videoElement.playbackRate = playbackRate;
		}
		isVideoPlaying = true;
		isVideoBuffering = false;
		showControlsTemporarily();
	}

	function handleVideoPause() {
		isVideoPlaying = false;
		isVideoBuffering = false;
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
			videoElement.muted = isMuted;
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

	// 全局监听：随 open 打开/关闭绑定，避免关闭预览后仍占用全局事件
	$effect(() => {
		if (!open) return;
		if (typeof document === 'undefined') return;

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

		// 键盘导航支持
		const handleKeyDown = (e: KeyboardEvent) => {
			// 忽略如果用户在输入框中
			const target = e.target as HTMLElement;
			if (target?.closest('input, textarea, [contenteditable="true"]')) return;

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
						if (isVideoPlaying) requestPause();
						else requestPlay();
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
			document.removeEventListener('keydown', handleKeyDown);
			if (isMobile) {
				document.removeEventListener('touchstart', handleTouchStartForControls);
			}
		};
	});

	// 缓冲/卡顿检测：waiting/stalled 时展示 loading，canplay/playing 时隐藏
	$effect(() => {
		const el = videoElement;
		if (!el) return;

		const setBuffering = (v: boolean) => {
			// 只在当前媒体为视频且处于打开状态时更新，避免切走后闪烁
			if (!open || !isVideo) return;
			isVideoBuffering = v;
		};

		const onWaiting = () => setBuffering(true);
		const onStalled = () => setBuffering(true);
		const onSeeking = () => setBuffering(true);
		const onSeeked = () => setBuffering(false);
		const onCanPlay = () => setBuffering(false);
		const onPlaying = () => setBuffering(false);
		const onPause = () => setBuffering(false);

		el.addEventListener('waiting', onWaiting);
		el.addEventListener('stalled', onStalled);
		el.addEventListener('seeking', onSeeking);
		el.addEventListener('seeked', onSeeked);
		el.addEventListener('canplay', onCanPlay);
		el.addEventListener('playing', onPlaying);
		el.addEventListener('pause', onPause);

		return () => {
			el.removeEventListener('waiting', onWaiting);
			el.removeEventListener('stalled', onStalled);
			el.removeEventListener('seeking', onSeeking);
			el.removeEventListener('seeked', onSeeked);
			el.removeEventListener('canplay', onCanPlay);
			el.removeEventListener('playing', onPlaying);
			el.removeEventListener('pause', onPause);
		};
	});

	// 视频控制界面点击
	function handleControlsClick(event: MouseEvent) {
		event.stopPropagation();
		showControls = true;
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
			media.single?.fileId ??
			media.livePhoto?.image?.fileId ??
			media.livePhoto?.video?.fileId ??
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

	// 处理右键菜单
	function handleContextMenu(event: MouseEvent) {
		// 手机端禁用右键菜单
		if (isMobile) {
			event.preventDefault();
			return;
		}
		event.preventDefault();
		openDownloadMenuAtPoint(event.clientX, event.clientY);
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
			if (Date.now() - lastPanEndTime < TAP_IGNORE_AFTER_PAN_MS) return;
			if (Date.now() - lastOpenedAt < TAP_IGNORE_AFTER_OPEN_MS) return;
			handleContentTap(e.target);
		}}
		onkeydown={(e) => {
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
			<div
				bind:this={gestureContainerEl}
				class="group relative flex h-full w-full items-center justify-center overflow-hidden"
				use:swipe={swipeOptions}
				use:tap={tapOptions}
				use:longPress={longPressOptions}
			>
				<div
					class="h-full w-full"
					style={`transform: translateX(${panOffsetX}px); transition: ${isPanning ? 'none' : 'transform 0.25s ease-out'};`}
				>
					{#if isImage}
						<!-- 图片 -->
						<ImagePreview {mediaList} {currentIndex} {handleContextMenu} />
					{:else if isVideo}
						<!-- 视频 -->
						<VideoPreview
							{mediaList}
							{currentIndex}
							{currentMedia}
							{isVideoPlaying}
							{isVideoBuffering}
							{isFullscreen}
							{isMobile}
							{showControls}
							{playbackRate}
							{videoProgress}
							{videoDuration}
							{volume}
							{isMuted}
							{playbackRatePopoverOpen}
							{handleVideoPlay}
							{handleVideoPause}
							{handleVideoTimeUpdate}
							{handleVideoLoadedMetadata}
							{togglePlay}
							{handleControlsClick}
							{handleProgressChange}
							{handleProgressMouseDown}
							{handleProgressMouseUp}
							{toggleMute}
							{handleVolumeChange}
							{changePlaybackRate}
							{toggleFullscreen}
							{handleContextMenu}
							bind:videoElement
							bind:videoContainer
						/>
					{/if}
				</div>

				<!-- 左右切换按钮（仅在有多张媒体时显示，且非视频全屏状态） -->
				{#if mediaList.length > 1 && !(isVideo && isFullscreen)}
					<!-- 上一张 -->
					<button
						data-preview-nav
						class={cn(
							'absolute top-1/2 left-4 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-white transition-all hover:scale-110 hover:bg-black/60',
							'hidden opacity-60 group-hover:opacity-100 md:block',
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
						data-preview-nav
						class={cn(
							'absolute top-1/2 right-4 z-10 hidden -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-white transition-all hover:scale-110 hover:bg-black/60 md:block',
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
						data-preview-nav
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

	<!-- 长按边缘二倍速提示（松手即恢复 1x） -->
	{#if isEdgeTwoSpeedActive}
		<div
			class="fixed top-1/3 left-1/2 z-70 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-sm text-white shadow-lg"
			role="status"
			aria-live="polite"
		>
			二倍速
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
