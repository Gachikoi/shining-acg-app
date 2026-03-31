<script lang="ts">
	/**
	 * ImageVideoPreview 子组件：纯图片横滑轨道。
	 * 边缘拖拽缩放回弹：单一 matrix（translate + scale）+ 同一时间曲线，便于浏览器按「倒放」插值，避免分层不同步造成闪现。
	 */
	import type { V1MediaAsset as Media } from '$lib/api';
	import { getMediaDisplayUrl } from '$lib/utils/media-url';

	const {
		mediaList = [] as Media[],
		currentIndex = 0,
		handleContextMenu,
		edgePullScale = 1,
		edgePullTranslateX = 0,
		edgePullTranslateY = 0,
		/** true 时关闭 transform 过渡（手指未抬起） */
		edgePullInstant = false
	}: {
		mediaList?: Media[];
		currentIndex?: number;
		handleContextMenu?: (event: MouseEvent) => void;
		edgePullScale?: number;
		edgePullTranslateX?: number;
		edgePullTranslateY?: number;
		edgePullInstant?: boolean;
	} = $props();

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
