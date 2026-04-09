<script lang="ts">
	/**
	 * @component ImagePreview
	 *
	 * **职责**：渲染“图片视图”（多图横滑轨道 + 当前帧 edge pull 的 transform/transition）。
	 * **不负责**：edge pull 的手势计算、阈值判断与飞回动画 —— 这些由 `controllers/image-controller.svelte.ts` 提供。
	 *
	 * 设计要点：edge pull 仅通过 `transform: translate3d(...) scale(...)` 动画，避免布局抖动。
	 */
	import type { V1MediaAsset as Media } from '$lib/api';
	import { getMediaDisplayUrl } from '$lib/utils/media-url';
	import type { ImageController } from '../controllers/image-controller.svelte';

	const {
		mediaList = [] as Media[],
		currentIndex = 0,
		handleContextMenu,
		controller
	}: {
		mediaList?: Media[];
		currentIndex?: number;
		handleContextMenu?: (event: MouseEvent) => void;
		controller: ImageController;
	} = $props();

	const edgePullScale = $derived(controller.state.imageEdgePullScale);
	const edgePullTranslateX = $derived(controller.state.imageEdgePullDx);
	const edgePullTranslateY = $derived(controller.state.imageEdgePullDy);
	const edgePullInstant = $derived(controller.state.isPanning);

	/** 弹回时长：与 `index.svelte` 的 `IMAGE_EDGE_SPRING_MS` 一致，便于松手后整段动画再关预览、撤帖内遮罩 */
	const EDGE_SPRING_S = 1.15;
	/** 前半略快、末段明显减速，接近拖出时主观速度曲线的倒放 */
	const EDGE_SPRING_EASE = 'cubic-bezier(0.2, 0.92, 0.35, 1)';

	/**
	 * 加载失败时不展示 alt 占位，仅保留全屏预览底背景。
	 *
	 * @param e - img error 事件
	 */
	function onPreviewImageError(e: Event) {
		const el = e.currentTarget;
		if (el instanceof HTMLImageElement) el.style.display = 'none';
	}
</script>

<div class="relative flex h-full w-full items-center justify-center">
	<div
		class="flex h-full w-full transition-transform duration-300 ease-out"
		style={`transform: translateX(-${currentIndex * 100}%);`}
	>
		{#each mediaList as media, index (media.assetId ?? index)}
			{#if index === currentIndex || index === currentIndex - 1 || index === currentIndex + 1 || mediaList.length <= 3}
				<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center">
					{#if index === currentIndex}
						<div
							class="flex max-h-full max-w-full items-center justify-center"
							style={`transform: translate3d(${edgePullTranslateX}px, ${edgePullTranslateY}px, 0) scale(${edgePullScale}); transform-origin: center center; ${
								edgePullInstant
									? 'transition: none;'
									: `transition: transform ${EDGE_SPRING_S}s ${EDGE_SPRING_EASE};`
							}`}
						>
							<!-- `data-preview-fly-source`：飞回帖内槽位动画起点取该 img 的 getBoundingClientRect（object-fit: contain 后的真实显示框，非外层容器） -->
							<img
								data-preview-fly-source
								src={getMediaDisplayUrl(media)}
								alt=""
								role="presentation"
								draggable="false"
								class="max-h-full max-w-full object-contain select-none"
								style="pointer-events: none; -webkit-user-drag: none; user-select: none;"
								oncontextmenu={handleContextMenu}
								onerror={onPreviewImageError}
							/>
						</div>
					{:else}
						<div class="flex max-h-full max-w-full items-center justify-center">
							<img
								src={getMediaDisplayUrl(media)}
								alt=""
								role="presentation"
								draggable="false"
								class="max-h-full max-w-full object-contain select-none"
								style="pointer-events: none; -webkit-user-drag: none; user-select: none;"
								oncontextmenu={handleContextMenu}
								onerror={onPreviewImageError}
							/>
						</div>
					{/if}
				</div>
			{:else}
				<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center"></div>
			{/if}
		{/each}
	</div>
</div>
