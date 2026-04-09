/**
 * @module video-controller
 *
 * **职责**：封装 `ImageVideoPreview` 中“视频播放域”的状态机与副作用，避免 `index.svelte` 臃肿。
 *
 * - **State**：播放/缓冲/进度/时长/音量/静音/倍速/全屏/边缘 2x 状态
 * - **Actions**：play/pause/toggle、倍速/音量、全屏切换、自动播放去重、缓冲监听绑定
 * - **Bindings**：接收 `videoElement` / `videoContainer` 的引用
 *
 * **说明**：这是一个 `.svelte.ts` 模块，内部使用 runes（`$state`）以便被 Svelte 组件直接消费。
 */
import type { V1MediaAsset as Media } from '$lib/api';

export type VideoController = ReturnType<typeof createVideoController>;

type VideoControllerInput = {
	isMobile: boolean;
};

export function createVideoController(input: VideoControllerInput) {
	let videoElement = $state<HTMLVideoElement | null>(null);
	let videoContainer = $state<HTMLDivElement | null>(null);

	let isVideoPlaying = $state(false);
	let playbackRate = $state(1);
	let volume = $state(1);
	let isMuted = $state(false);
	let videoProgress = $state(0);
	let videoDuration = $state(0);
	let isFullscreen = $state(false);
	let isSeeking = $state(false);
	let isVideoBuffering = $state(false);

	let playbackRatePopoverOpen = $state(false);
	let isEdgeTwoSpeedActive = $state(false);
	const EDGE_TWO_SPEED_RATIO = 0.18;
	const EDGE_TWO_SPEED_MIN_PX = 56;
	const EDGE_TWO_SPEED_MAX_PX = 88;

	// 统一管理 play() 请求，避免 play/pause 竞态导致 AbortError
	let playRequestSeq = 0;
	let lastAutoplayKey: string | null = null;
	let lastPausedByTapTime = 0;

	function setVideoElement(el: HTMLVideoElement | null) {
		videoElement = el;
	}
	function setVideoContainer(el: HTMLDivElement | null) {
		videoContainer = el;
	}

	async function requestPlay() {
		const el = videoElement;
		if (!el) return;
		const seq = ++playRequestSeq;
		try {
			const p = el.play();
			if (p && typeof (p as Promise<void>).then === 'function') {
				await p;
			}
		} catch {
			if (seq !== playRequestSeq) return;
		}
	}

	function requestPause() {
		const el = videoElement;
		if (!el) return;
		playRequestSeq++;
		try {
			el.pause();
		} catch {
			// ignore
		}
		isVideoBuffering = false;
	}

	function togglePlay(tapPauseIgnoreMs = 220) {
		if (isVideoPlaying) {
			lastPausedByTapTime = Date.now();
			requestPause();
		} else {
			if (Date.now() - lastPausedByTapTime < tapPauseIgnoreMs) {
				lastPausedByTapTime = 0;
				return;
			}
			requestPlay();
		}
	}

	function stopBeforeSwitch() {
		const el = videoElement;
		if (el) {
			playRequestSeq++;
			try {
				el.pause();
			} catch {
				// ignore
			}
			el.currentTime = 0;
			el.playbackRate = 1;
		}
		isVideoPlaying = false;
		isVideoBuffering = false;
		playbackRate = 1;
	}

	function handleVideoPlay() {
		const el = videoElement;
		if (el) {
			el.playbackRate = playbackRate;
		}
		isVideoPlaying = true;
		isVideoBuffering = false;
	}

	function handleVideoPause() {
		isVideoPlaying = false;
		isVideoBuffering = false;
	}

	function handleVideoTimeUpdate() {
		const el = videoElement;
		if (el && !isSeeking) {
			if (videoDuration > 0) videoProgress = el.currentTime / videoDuration;
			else videoProgress = 0;
		}
	}

	function handleVideoLoadedMetadata() {
		const el = videoElement;
		if (!el) return;
		videoDuration = el.duration || 0;
		videoProgress = videoDuration > 0 ? el.currentTime / videoDuration : 0;
		el.playbackRate = playbackRate;
		el.volume = volume;
		el.muted = isMuted;
	}

	function handleProgressChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const el = videoElement;
		if (!el) return;
		const newTime = parseFloat(target.value) * videoDuration;
		el.currentTime = newTime;
		videoProgress = parseFloat(target.value);
	}

	function handleProgressMouseDown() {
		isSeeking = true;
	}
	function handleProgressMouseUp() {
		isSeeking = false;
	}

	function toggleMute() {
		const el = videoElement;
		if (!el) return;
		isMuted = !isMuted;
		el.muted = isMuted;
	}

	function handleVolumeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		volume = parseFloat(target.value);
		const el = videoElement;
		if (!el) return;
		el.volume = volume;
		isMuted = volume === 0;
	}

	function changePlaybackRate(rate: number) {
		playbackRate = rate;
		const el = videoElement;
		if (el) el.playbackRate = rate;
		playbackRatePopoverOpen = false;
	}

	function getEdgeTwoSpeedWidthPx(containerWidth: number): number {
		return Math.min(
			EDGE_TWO_SPEED_MAX_PX,
			Math.max(EDGE_TWO_SPEED_MIN_PX, containerWidth * EDGE_TWO_SPEED_RATIO)
		);
	}

	function isEdgeTwoSpeedZoneByClientX(clientX: number, rect: DOMRect): boolean {
		const edgePx = getEdgeTwoSpeedWidthPx(rect.width);
		return clientX < rect.left + edgePx || clientX > rect.right - edgePx;
	}

	function tryActivateEdgeTwoSpeed(clientX: number, rect: DOMRect): boolean {
		if (!isEdgeTwoSpeedZoneByClientX(clientX, rect)) return false;
		isEdgeTwoSpeedActive = true;
		changePlaybackRate(2);
		return true;
	}

	function deactivateEdgeTwoSpeed() {
		if (!isEdgeTwoSpeedActive) return;
		isEdgeTwoSpeedActive = false;
		changePlaybackRate(1);
	}

	function handleFullscreenChange() {
		const isFs =
			typeof document !== 'undefined' &&
			!!document.fullscreenElement &&
			document.fullscreenElement === videoContainer;
		isFullscreen = isFs;
	}

	function toggleFullscreen() {
		if (typeof document === 'undefined') return;

		// 移动端优先：尝试容器全屏；失败回退 video 元素全屏（iOS）
		if (input.isMobile && videoElement) {
			const videoEl = videoElement as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
			const containerEl = videoContainer;
			if (containerEl && containerEl.requestFullscreen) {
				containerEl.requestFullscreen().catch(() => {
					if (videoEl.webkitEnterFullscreen) {
						videoEl.webkitEnterFullscreen();
						isFullscreen = true;
					}
				});
				return;
			}
			if (videoEl.webkitEnterFullscreen) {
				videoEl.webkitEnterFullscreen();
				isFullscreen = true;
				return;
			}
		}

		const el = videoContainer;
		if (!el) return;
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
		}
	}

	function syncAutoplay(
		open: boolean,
		autoplay: boolean,
		currentIndex: number,
		currentMedia: Media | null
	) {
		if (!open) return;
		if (!autoplay) return;
		if (currentMedia?.type !== 'MEDIA_TYPE_VIDEO') return;
		if (!videoElement) return;
		const key = `${currentMedia?.assetId ?? currentIndex}`;
		if (lastAutoplayKey === key) return;
		lastAutoplayKey = key;
		requestPlay();
	}

	function resetOnOpen() {
		isVideoPlaying = false;
		lastAutoplayKey = null;
		playbackRate = 1;
		videoProgress = 0;
		videoDuration = 0;
		volume = 1;
		isMuted = false;
		isFullscreen = false;
		isSeeking = false;
		isVideoBuffering = false;
		playbackRatePopoverOpen = false;
		isEdgeTwoSpeedActive = false;
	}

	function teardownOnClose() {
		// 关闭时退出全屏（如果仍处于全屏）
		if (
			typeof document !== 'undefined' &&
			document.fullscreenElement &&
			document.fullscreenElement === videoContainer
		) {
			document.exitFullscreen?.().catch(() => {});
		}
		// 关闭时暂停视频并归零
		if (videoElement) {
			playRequestSeq++;
			videoElement.pause();
			videoElement.currentTime = 0;
		}
		isVideoBuffering = false;
		isEdgeTwoSpeedActive = false;
	}

	function attachBufferingListeners(openGetter: () => boolean, isVideoGetter: () => boolean) {
		const el = videoElement;
		if (!el) return () => {};
		const setBuffering = (v: boolean) => {
			if (!openGetter() || !isVideoGetter()) return;
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
	}

	return {
		state: {
			get videoElement() {
				return videoElement;
			},
			get videoContainer() {
				return videoContainer;
			},
			get isVideoPlaying() {
				return isVideoPlaying;
			},
			get playbackRate() {
				return playbackRate;
			},
			get volume() {
				return volume;
			},
			get isMuted() {
				return isMuted;
			},
			get videoProgress() {
				return videoProgress;
			},
			get videoDuration() {
				return videoDuration;
			},
			get isFullscreen() {
				return isFullscreen;
			},
			get isVideoBuffering() {
				return isVideoBuffering;
			},
			get playbackRatePopoverOpen() {
				return playbackRatePopoverOpen;
			},
			get isEdgeTwoSpeedActive() {
				return isEdgeTwoSpeedActive;
			}
		},
		bindings: { setVideoElement, setVideoContainer },
		actions: {
			requestPlay,
			requestPause,
			togglePlay,
			stopBeforeSwitch,
			handleVideoPlay,
			handleVideoPause,
			handleVideoTimeUpdate,
			handleVideoLoadedMetadata,
			handleProgressChange,
			handleProgressMouseDown,
			handleProgressMouseUp,
			toggleMute,
			handleVolumeChange,
			changePlaybackRate,
			tryActivateEdgeTwoSpeed,
			deactivateEdgeTwoSpeed,
			getEdgeTwoSpeedWidthPx,
			toggleFullscreen,
			handleFullscreenChange,
			syncAutoplay,
			resetOnOpen,
			teardownOnClose,
			attachBufferingListeners
		}
	};
}
