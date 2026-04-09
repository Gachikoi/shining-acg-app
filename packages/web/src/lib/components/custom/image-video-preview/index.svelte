<script lang="ts">
	/**
	 * @component ImageVideoPreview（全屏/弹层媒体预览）
	 *
	 * **职责**：在帖子详情、发布预览等场景放大查看 `V1MediaAsset[]`；支持左右滑动/按钮切页、视频播放控制、下载、键盘导航。
	 *
	 * **目录结构（本组件族）**
	 * | 文件 | 作用 |
	 * |------|------|
	 * | `index.svelte`（本文件） | 预览壳 + 手势分发 + 生命周期协调（尽量不放业务细节） |
	 * | `views/Image-preview.svelte` | 图片视图（渲染 + transform/transition） |
	 * | `views/Video-preview.svelte` | 视频视图（渲染 + 控制条 UI） |
	 * | `controllers/*.svelte.ts` | 图片/视频/下载域控制器（状态机 + 动作 + 副作用绑定） |
	 * | `gestures/*` | 手势计算纯函数 |
	 * | `utils/*` | 动画/几何工具 fly-to-rect|
	 *
	 * **依赖**：展示 URL 统一经 `$lib/utils/media-url` 的 `getMediaDisplayUrl`；手势见 `$lib/modules/gesture`（含 `use:scrollBoundary`）。移动端与桌面端行为（如忽略打开后误触关闭）见文件内常量注释。
	 */
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import type { V1MediaAsset as Media } from '$lib/api';
	import { X, Download } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { getMediaDisplayUrl } from '$lib/utils/media-url';
	import { isMobileUA } from '$lib/utils/device';
	import { scrollBoundary, swipe, tap, longPress, type SwipeState } from '$lib/modules/gesture';
	import ImagePreview from './views/Image-preview.svelte';
	import VideoPreview from './views/Video-preview.svelte';
	import { createDownloadController } from './controllers/download-controller.svelte';
	import { createVideoController } from './controllers/video-controller.svelte';
	import { createImageController, type EdgePullMode } from './controllers/image-controller.svelte';

	let {
		open = $bindable(false),
		mediaList = [] as Media[],
		initialIndex = 0,
		autoplay = true,
		fullScreen = true,
		class: className = '',
		/** 帖内媒体槽位矩形，用于图片首尾拖拽松手后飞回动画；未传则仅关闭预览（兼容旧命名） */
		getMediaSlotRect,
		/** 更通用的 dismiss 目标矩形；若提供则优先使用 */
		getDismissTargetRect,
		/** 边缘拖拽模式：none 禁用图片首尾自由拖拽/回弹/飞回 */
		edgePullMode = 'rubber-band',
		/** 图片首尾边缘拖拽时为 true，供 post-detail 媒体区盖空白层 */
		edgePullBlank = $bindable(false),
		/** 更通用的边缘拖拽状态输出（复用对象，避免 move 高频分配） */
		onEdgePullStateChange,
		/** 关闭时回传当前索引，便于父级同步 `activeIndex` */
		onClose
	}: {
		open?: boolean;
		mediaList?: Media[];
		initialIndex?: number;
		autoplay?: boolean;
		fullScreen?: boolean;
		class?: string;
		getMediaSlotRect?: (index: number) => DOMRect | null;
		getDismissTargetRect?: (index: number) => DOMRect | null;
		edgePullMode?: 'none' | 'rubber-band';
		edgePullBlank?: boolean;
		onEdgePullStateChange?: (state: {
			mode: 'none' | 'rubber-band';
			isEdgePulling: boolean;
			dx: number;
			dy: number;
			dist: number;
			scale: number;
			backdropAlpha: number;
			isBlank: boolean;
		}) => void;
		onClose?: (lastIndex: number) => void;
	} = $props();

	// 检测移动端设备（通过 UA）
	const isMobile = $derived.by(() => isMobileUA());

	// 当前显示的媒体索引
	let currentIndex = $state(0);

	// UI：控制条是否显示（目前仍由父组件管理；后续可继续下沉到 controller）
	let showControls = $state(true);

	// DOM refs
	let gestureContainerEl: HTMLElement | null = $state(null);
	let dialogEl: HTMLDivElement | null = $state(null);

	// 刚打开预览后一段时间内忽略关闭（避免移动端「打开」触发的合成 click 落在预览层上误关）
	let lastOpenedAt = 0;
	const TAP_IGNORE_AFTER_OPEN_MS = 420;
	const TAP_PAUSE_IGNORE_PLAY_MS = 220;

	// 刚关闭下载菜单后的短时间，避免随后触发的合成 click 误关预览（仅图片模式）
	const DOWNLOAD_MENU_CLOSED_GRACE_MS = 450;

	/** 开发态：视频 2x 边缘区辅助线是否显示（默认开，仅 DEV 显示切换按钮） */
	let devVideoEdgeGuideVisible = $state(true);

	// 当前媒体
	const currentMedia = $derived(
		mediaList.length > 0 && currentIndex >= 0 && currentIndex < mediaList.length
			? mediaList[currentIndex]
			: null
	);
	const isImage = $derived(currentMedia?.type === 'MEDIA_TYPE_IMAGE');
	const isVideo = $derived(currentMedia?.type === 'MEDIA_TYPE_VIDEO');

	// Controllers
	const download = createDownloadController();
	const video = createVideoController({ isMobile: isMobileUA() });
	let videoElement = $state<HTMLVideoElement | null>(null);
	let videoContainer = $state<HTMLDivElement | null>(null);

	$effect(() => {
		video.bindings.setVideoElement(videoElement);
	});
	$effect(() => {
		video.bindings.setVideoContainer(videoContainer);
	});

	$effect(() => {
		return video.actions.attachBufferingListeners(
			() => open,
			() => isVideo
		);
	});

	function getVideoGestureRect(fallback?: HTMLElement | null): DOMRect | null {
		const host = gestureContainerEl ?? video.state.videoContainer ?? fallback ?? null;
		return host?.getBoundingClientRect() ?? null;
	}

	function getPreviewFlySourceRect(): DOMRect | null {
		const host = gestureContainerEl;
		if (!host) return null;
		const img = host.querySelector<HTMLImageElement>('[data-preview-fly-source]');
		const r = img?.getBoundingClientRect();
		if (!r || r.width < 2 || r.height < 2) return null;
		return r;
	}

	const image = createImageController({
		fullScreen: () => fullScreen,
		isMobile: () => isMobile,
		isImage: () => isImage,
		mediaCount: () => mediaList.length,
		getCurrentIndex: () => currentIndex,
		getMediaDisplayUrl: () => (currentMedia ? getMediaDisplayUrl(currentMedia) : ''),
		getGestureRect: () => gestureContainerEl?.getBoundingClientRect() ?? null,
		getPreviewFlySourceRect,
		getDismissTargetRect: () => {
			const fn = getDismissTargetRect ?? getMediaSlotRect;
			return fn ? fn(currentIndex) : null;
		},
		onRequestClose: () => handleClose(),
		onRequestPrev: () => prevMedia(),
		onRequestNext: () => nextMedia(),
		onEdgePullBlankChange: (b) => {
			edgePullBlank = b;
		}
	});

	$effect(() => {
		image.config.setEdgePullMode(edgePullMode as EdgePullMode);
		image.config.setOnEdgePullStateChange(onEdgePullStateChange);
	});

	function showControlsTemporarily() {
		showControls = true;
	}

	function showDownloadError(message: string) {
		toast.error(message, {
			duration: message.length > 36 ? 4200 : 2800
		});
	}

	async function downloadMediaWithToast(media: Media): Promise<boolean> {
		const res = await download.actions.downloadMedia(media);
		if (!res.ok && res.errorMessage) {
			showDownloadError(res.errorMessage);
		}
		return res.ok;
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
			showControls = true;
			download.actions.close();
			video.actions.resetOnOpen();
			image.actions.resetOnOpen();
			// 让预览层获得焦点，避免空格/ESC 等键盘事件冒泡到 post-detail
			queueMicrotask(() => {
				// 若组件很快卸载/关闭，避免空引用
				if (!open) return;
				dialogEl?.focus?.();
			});
		} else {
			download.actions.close();
			video.actions.teardownOnClose();
			video.actions.deactivateEdgeTwoSpeed();
		}
	});

	// 下载菜单打开时：点击/触摸菜单外区域 -> 关闭菜单（不改变播放状态）
	$effect(() => {
		if (!open) return;
		if (typeof document === 'undefined') return;

		const closeDownloadMenuIfNeeded = (target: HTMLElement | null) => {
			if (!download.state.isOpen) return;
			// 点击菜单内：不处理
			if (target?.closest?.('[data-download-menu]')) return;
			// 点击预览导航/控件：不处理（避免误关菜单导致交互突兀）
			if (target?.closest?.('[data-preview-nav]')) return;
			if (target?.closest?.('.video-controls')) return;
			if (target?.closest?.('.play-button-area')) return;
			download.actions.close();
		};

		const onPointerDownCapture = (e: PointerEvent) =>
			closeDownloadMenuIfNeeded(e.target as HTMLElement | null);
		const onMouseDownCapture = (e: MouseEvent) =>
			closeDownloadMenuIfNeeded(e.target as HTMLElement | null);
		const onTouchStartCapture = (e: TouchEvent) =>
			closeDownloadMenuIfNeeded(e.target as HTMLElement | null);

		document.addEventListener('pointerdown', onPointerDownCapture, true);
		document.addEventListener('mousedown', onMouseDownCapture, true);
		document.addEventListener('touchstart', onTouchStartCapture, { capture: true, passive: true });
		return () => {
			document.removeEventListener('pointerdown', onPointerDownCapture, true);
			document.removeEventListener('mousedown', onMouseDownCapture, true);
			document.removeEventListener('touchstart', onTouchStartCapture, true);
		};
	});

	// 进入视频预览（滑动切换进入 or 直接打开就是视频）时自动尝试播放一次（每个视频仅一次）
	$effect(() => {
		video.actions.syncAutoplay(open, autoplay, currentIndex, currentMedia);
	});

	function stopCurrentVideoBeforeSwitch() {
		video.actions.stopBeforeSwitch();
		video.actions.deactivateEdgeTwoSpeed();
		showControls = true;
	}

	// 切换上一张/下一张
	function prevMedia() {
		if (mediaList.length <= 1) {
			handleClose();
			return;
		}
		stopCurrentVideoBeforeSwitch();
		if (currentIndex > 0) {
			currentIndex = currentIndex - 1;
		} else {
			handleClose();
		}
	}

	function nextMedia() {
		if (mediaList.length <= 1) {
			handleClose();
			return;
		}
		stopCurrentVideoBeforeSwitch();
		if (currentIndex < mediaList.length - 1) {
			currentIndex = currentIndex + 1;
		} else {
			handleClose();
		}
	}

	function blockClickThroughOnce() {
		// 兜底移动端“ghost click / click-through”：
		// 预览层关闭后，同一次触摸可能会在下层（post-detail 遮罩）再合成一次 click，导致把整个帖子也关掉。
		if (typeof document === 'undefined') return;

		const startedAt = performance.now();
		const MAX_MS = 520;

		const handler = (e: Event) => {
			// 仅短窗口内拦截一次
			if (performance.now() - startedAt > MAX_MS) {
				cleanup();
				return;
			}
			try {
				e.preventDefault?.();
				(e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
				e.stopPropagation?.();
			} finally {
				cleanup();
			}
		};

		const cleanup = () => {
			document.removeEventListener('click', handler, true);
			document.removeEventListener('pointerdown', handler, true);
			document.removeEventListener('pointerup', handler, true);
		};

		document.addEventListener('click', handler, true);
		document.addEventListener('pointerdown', handler, true);
		document.addEventListener('pointerup', handler, true);

		// 双保险：即使事件没来，也会自动清理
		setTimeout(cleanup, MAX_MS + 60);
	}

	/** 关闭预览 */
	function handleClose() {
		download.actions.close();
		video.actions.deactivateEdgeTwoSpeed();
		blockClickThroughOnce();
		onClose?.(currentIndex);
		open = false;
		edgePullBlank = false;
		showControls = true;
	}

	function openDownloadMenuAtPoint(x: number, y: number) {
		download.actions.openAtPoint(x, y);
	}

	// 统一轻击逻辑（含 PC click / 移动端 tap）：
	// - 点下载菜单不触发其它动作
	// - 点视频控制区/播放按钮交给控件自身处理
	// - 视频：播放态轻击暂停；暂停态轻击播放；若下载菜单打开，轻击菜单外仅关闭菜单（不改变播放状态）
	// - 图片：轻击关闭预览（下载菜单打开则仅关闭菜单）
	function handleContentTap(target: EventTarget | null) {
		const el = target as HTMLElement;
		if (el?.closest('[data-download-menu]')) return;
		if (el?.closest('.video-controls')) return;
		if (el?.closest('.play-button-area')) return;
		// 点击小圆点/左右切换按钮等导航区只切换内容，不关闭预览
		if (el?.closest('[data-preview-nav]')) return;
		if (download.state.isOpen) {
			download.actions.close();
			return;
		}
		// 视频：轻击切换播放/暂停（不关闭预览）
		if (isVideo) {
			video.actions.togglePlay(TAP_PAUSE_IGNORE_PLAY_MS);
			showControlsTemporarily();
			return;
		}
		// 图片：刚关闭下载菜单后的短时间不关预览，避免合成 click 误关
		if (Date.now() - download.state.lastClosedAt < DOWNLOAD_MENU_CLOSED_GRACE_MS) return;
		// 刚打开后忽略：避免移动端「打开」产生的合成 click 落在预览层上误关
		if (Date.now() - lastOpenedAt < TAP_IGNORE_AFTER_OPEN_MS) return;
		handleClose();
	}

	// 同一交互层上 swipe + tap + long-press
	const swipeOptions = $derived.by(() => ({
		onStart() {
			image.actions.onSwipeStart();
		},
		onMove(state: SwipeState) {
			image.actions.onSwipeMove(state);
		},
		onEnd(state: SwipeState) {
			image.actions.onSwipeEnd(state);
		}
	}));

	/**
	 * 全屏打开时始终声明横向仍有余量，避免首页 SwipeablePane 在同轴上抢手势（与 post-media-area 外层 shield 双保险）。
	 */
	const previewScrollBoundaryOpts = $derived.by(() => ({
		axis: 'x' as const,
		canScroll(queryAxis: 'x' | 'y', _direction: number) {
			return queryAxis === 'x' && open && mediaList.length > 0;
		}
	}));

	const tapOptions = $derived.by(() => ({
		excludeSelector: '.video-controls, .play-button-area, [data-preview-nav]',
		onTap(detail: { target: EventTarget | null }) {
			handleContentTap(detail.target);
		}
	}));
	const longPressOptions = $derived.by(() => ({
		excludeSelector: '.video-controls',
		touchOnly: true,
		onPress(e: { x: number; clientX: number; clientY: number; currentTarget: HTMLElement }) {
			if (download.state.isOpen) return;
			const rect = getVideoGestureRect(e.currentTarget);
			if (isVideo) {
				if (rect && video.actions.tryActivateEdgeTwoSpeed(e.clientX, rect)) {
					return;
				}
				showControls = true;
			}
			openDownloadMenuAtPoint(e.clientX, e.clientY);
		},
		onPressUp() {
			video.actions.deactivateEdgeTwoSpeed();
		}
	}));

	function handleDialogKeyDown(e: KeyboardEvent) {
		// 忽略如果用户在输入框中
		const target = e.target as HTMLElement;
		if (target?.closest('input, textarea, [contenteditable="true"]')) return;

		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				e.stopPropagation();
				handleClose();
				return;
			case 'ArrowLeft':
				e.preventDefault();
				e.stopPropagation();
				if (mediaList.length > 1) prevMedia();
				return;
			case 'ArrowRight':
				e.preventDefault();
				e.stopPropagation();
				if (mediaList.length > 1) nextMedia();
				return;
			case ' ':
			case 'k':
				if (!isVideo) return;
				e.preventDefault();
				e.stopPropagation();
				video.actions.togglePlay(TAP_PAUSE_IGNORE_PLAY_MS);
				showControlsTemporarily();
				return;
		}
	}

	// 全局监听：随 open 打开/关闭绑定，避免关闭预览后仍占用全局事件
	$effect(() => {
		if (!open) return;
		if (typeof document === 'undefined') return;

		const handleFullscreenChange = () => {
			video.actions.handleFullscreenChange();
			showControls = true;
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		const docWithWebkit = document as Document & {
			webkitfullscreenchange?: Event;
			addEventListener?: (type: string, listener: () => void) => void;
			removeEventListener?: (type: string, listener: () => void) => void;
		};
		docWithWebkit.addEventListener?.('webkitfullscreenchange', handleFullscreenChange);

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
			if (isMobile) {
				document.removeEventListener('touchstart', handleTouchStartForControls);
			}
		};
	});

	// 下载当前媒体
	function handleDownloadCurrent() {
		if (currentMedia) {
			void downloadMediaWithToast(currentMedia);
		}
		download.actions.close();
	}

	// 下载全部媒体
	async function handleDownloadAll() {
		if (mediaList.length === 0) return;

		let failCount = 0;

		for (let i = 0; i < mediaList.length; i++) {
			const media = mediaList[i];
			const success = await downloadMediaWithToast(media);
			if (!success) {
				failCount++;
				// 失败时继续统计，最终汇总提示
			}
			// 添加延迟避免浏览器阻止多个下载
			if (i < mediaList.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		if (failCount > 0) {
			showDownloadError(`${failCount} 个文件下载失败，请重试或改为逐个保存`);
		}
		download.actions.close();
	}

	// 处理右键菜单
	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		// 移动端长按 video 触发 contextmenu 时，也必须与边缘二倍速逻辑保持一致
		if (isMobile && isVideo) {
			const rect = getVideoGestureRect(event.currentTarget as HTMLElement | null);
			if (rect && video.actions.tryActivateEdgeTwoSpeed(event.clientX, rect)) {
				return;
			}
		}
		openDownloadMenuAtPoint(event.clientX, event.clientY);
	}

	// 控制栏下载按钮：在按钮附近打开下载菜单
	function handleControlsDownloadClick(e: MouseEvent) {
		e.stopPropagation();
		// 控制栏下载：直接下载当前媒体（视频）
		if (currentMedia) {
			void downloadMediaWithToast(currentMedia);
		}
	}
</script>

{#if open}
	<div
		role="dialog"
		aria-label="图片视频预览"
		tabindex="-1"
		bind:this={dialogEl}
		class={cn(
			'fixed inset-0 z-60 flex flex-col items-center justify-center',
			fullScreen && !isImage ? 'bg-black' : '',
			!fullScreen ? 'bg-zinc-100' : '',
			image.state.isFlyClosing && 'pointer-events-none opacity-0',
			className
		)}
		style={fullScreen && isImage
			? `background-color: rgba(0,0,0,${image.state.imageEdgeBackdropAlpha});${
					image.state.edgePullBackdropTransition
						? 'transition: background-color 1.15s cubic-bezier(0.2, 0.92, 0.35, 1);'
						: ''
				}`
			: undefined}
		onkeydown={handleDialogKeyDown}
	>
		<!-- 关闭按钮 -->
		<div class={cn('absolute top-4 left-4', isVideo && video.state.isFullscreen ? 'z-70' : 'z-10')}>
			<Button
				variant="ghost"
				size="icon"
				class="min-h-11 min-w-11 text-white hover:bg-white/20"
				onclick={(e) => {
					e.stopPropagation();
					handleClose();
				}}
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
				use:scrollBoundary={previewScrollBoundaryOpts}
				use:swipe={swipeOptions}
				use:longPress={longPressOptions}
				use:tap={tapOptions}
			>
				{#if import.meta.env.DEV && isVideo}
					{@const edgeDebugPx = video.actions.getEdgeTwoSpeedWidthPx(
						gestureContainerEl?.getBoundingClientRect().width ??
							videoContainer?.getBoundingClientRect().width ??
							0
					)}
					<div class="pointer-events-none absolute inset-0 z-40">
						{#if devVideoEdgeGuideVisible}
							<div
								class="absolute top-0 bottom-0 left-0 border-r border-cyan-300/90 bg-cyan-400/10"
								style={`width: ${edgeDebugPx}px;`}
							></div>
							<div
								class="absolute top-0 right-0 bottom-0 border-l border-cyan-300/90 bg-cyan-400/10"
								style={`width: ${edgeDebugPx}px;`}
							></div>
						{/if}
						<div class="pointer-events-auto absolute top-3 right-4 z-50">
							<Button
								variant="secondary"
								size="sm"
								class="h-7 border border-white/25 bg-black/55 px-2 text-[10px] text-white hover:bg-black/75"
								onclick={(e) => {
									e.stopPropagation();
									devVideoEdgeGuideVisible = !devVideoEdgeGuideVisible;
								}}
							>
								开发模式 {devVideoEdgeGuideVisible ? '隐藏2倍速辅助线' : '显示2倍速辅助线'}
							</Button>
						</div>
					</div>
				{/if}
				<div
					class="h-full w-full"
					style={`transform: translateX(${image.state.panOffsetX}px); transition: ${image.state.isPanning ? 'none' : 'transform 0.25s ease-out'};`}
				>
					{#if isImage}
						<!-- 图片 -->
						<ImagePreview {mediaList} {currentIndex} {handleContextMenu} controller={image} />
					{:else if isVideo}
						<!-- 视频 -->
						<VideoPreview
							{mediaList}
							{currentIndex}
							{currentMedia}
							{isMobile}
							{showControls}
							controller={video}
							onDownloadClick={handleControlsDownloadClick}
							{handleContextMenu}
							bind:videoElement
							bind:videoContainer
						/>
					{/if}
				</div>

				<!-- 左右切换按钮（仅在有多张媒体时显示，且非视频全屏状态） -->
				{#if mediaList.length > 1 && !(isVideo && video.state.isFullscreen)}
					<!-- 上一张 -->
					<button
						data-preview-nav
						class={cn(
							'absolute top-1/2 left-4 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-white transition-all hover:scale-110 hover:bg-black/60',
							'hidden opacity-60 group-hover:opacity-100 md:block',
							currentIndex === 0 &&
								!(isVideo && video.state.isVideoPlaying) &&
								'cursor-not-allowed opacity-30 hover:scale-100'
						)}
						onclick={(e) => {
							e.stopPropagation();
							if (currentIndex > 0 || (isVideo && video.state.isVideoPlaying)) {
								prevMedia();
							}
						}}
						aria-label="上一张"
						type="button"
						disabled={currentIndex === 0 && !(isVideo && video.state.isVideoPlaying)}
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
								!(isVideo && video.state.isVideoPlaying) &&
								'cursor-not-allowed opacity-30 hover:scale-100'
						)}
						onclick={(e) => {
							e.stopPropagation();
							if (currentIndex < mediaList.length - 1 || (isVideo && video.state.isVideoPlaying)) {
								nextMedia();
							}
						}}
						aria-label="下一张"
						type="button"
						disabled={currentIndex === mediaList.length - 1 &&
							!(isVideo && video.state.isVideoPlaying)}
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

					<!-- 底部小圆点指示器（需高于暂停态播放覆盖层 `.play-button-area`） -->
					<div
						data-preview-nav
						class="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 opacity-60 transition-opacity group-hover:opacity-100"
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
										stopCurrentVideoBeforeSwitch();
										currentIndex = index;
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
	{#if download.state.isOpen && download.state.position}
		<div
			data-download-menu
			role="menu"
			tabindex="-1"
			class="fixed z-70 w-48 rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
			style={`left: ${download.state.position.x}px; top: ${download.state.position.y}px;`}
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
	{#if video.state.isEdgeTwoSpeedActive}
		<div
			class="fixed top-1/3 left-1/2 z-70 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-sm text-white shadow-lg"
			role="status"
			aria-live="polite"
		>
			二倍速
		</div>
	{/if}
{/if}
