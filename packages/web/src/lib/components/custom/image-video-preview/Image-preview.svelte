<script lang="ts">
	/**
	 * ImageVideoPreview 子组件：纯图片横滑轨道。
	 * 仅对当前索引及相邻项挂载 `<img>`，减少大图同时解码数量；URL 来自 `getMediaDisplayUrl`。
	 * `edgePull*`：拖拽缩放回槽位时的跟手缩放与位移；弹回时位移与缩放分层过渡，放大更明显。
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

	/** 弹回：位移层略快、缩放层略慢，强化「慢慢放大」 */
	const EDGE_SPRING_TRANSLATE_S = 0.72;
	const EDGE_SPRING_SCALE_S = 0.88;
	/** 位移：先较快回到视野中心附近 */
	const EDGE_EASE_TRANSLATE = 'cubic-bezier(0.2, 0.82, 0.38, 1)';
	/** 缩放：略长、略慢收尾，强化「慢慢放大」 */
	const EDGE_EASE_SCALE = 'cubic-bezier(0.15, 0.75, 0.28, 1)';
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
							style={edgePullInstant
								? `transform: translate3d(${edgePullTranslateX}px, ${edgePullTranslateY}px, 0);`
								: `transform: translate3d(${edgePullTranslateX}px, ${edgePullTranslateY}px, 0); transition: transform ${EDGE_SPRING_TRANSLATE_S}s ${EDGE_EASE_TRANSLATE};`}
						>
							<div
								class="flex max-h-full max-w-full items-center justify-center"
								style={edgePullInstant
									? `transform: scale(${edgePullScale}); transform-origin: center center;`
									: `transform: scale(${edgePullScale}); transform-origin: center center; transition: transform ${EDGE_SPRING_SCALE_S}s ${EDGE_EASE_SCALE};`}
							>
								<img
									src={getMediaDisplayUrl(media)}
									alt="预览图片"
									draggable="false"
									class="max-h-full max-w-full object-contain select-none"
									style="pointer-events: none; -webkit-user-drag: none; user-select: none;"
									oncontextmenu={handleContextMenu}
								/>
							</div>
						</div>
					{:else}
						<div class="flex max-h-full max-w-full items-center justify-center">
							<img
								src={getMediaDisplayUrl(media)}
								alt="预览图片"
								draggable="false"
								class="max-h-full max-w-full object-contain select-none"
								style="pointer-events: none; -webkit-user-drag: none; user-select: none;"
								oncontextmenu={handleContextMenu}
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
