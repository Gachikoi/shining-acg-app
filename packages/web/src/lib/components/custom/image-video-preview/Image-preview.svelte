<script lang="ts">
	/**
	 * ImageVideoPreview 子组件：纯图片横滑轨道。
	 * 仅对当前索引及相邻项挂载 `<img>`，减少大图同时解码数量；URL 来自 `getMediaDisplayUrl`。
	 */
	import type { V1MediaAsset as Media } from '$lib/api';
	import { getMediaDisplayUrl } from '$lib/media-url';

	const {
		mediaList = [] as Media[],
		currentIndex = 0,
		handleContextMenu
	}: {
		mediaList?: Media[];
		currentIndex?: number;
		handleContextMenu?: (event: MouseEvent) => void;
	} = $props();
</script>

<div class="relative flex h-full w-full items-center justify-center">
	<div
		class="flex h-full w-full transition-transform duration-300 ease-out"
		style={`transform: translateX(-${currentIndex * 100}%);`}
	>
		{#each mediaList as media, index (media.assetId ?? index)}
			{#if index === currentIndex || index === currentIndex - 1 || index === currentIndex + 1 || mediaList.length <= 3}
				<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center">
					<img
						src={getMediaDisplayUrl(media)}
						alt="预览图片"
						draggable="false"
						class="max-h-full max-w-full object-contain transition-all duration-300 select-none"
						style="pointer-events: none; -webkit-user-drag: none; user-select: none;"
						oncontextmenu={handleContextMenu}
					/>
				</div>
			{:else}
				<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center"></div>
			{/if}
		{/each}
	</div>
</div>
