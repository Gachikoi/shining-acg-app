<script lang="ts">
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
		{#each mediaList as media, index (media.asset_id ?? index)}
			{#if index === currentIndex || index === currentIndex - 1 || index === currentIndex + 1 || mediaList.length <= 3}
				<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center">
					<img
						src={getMediaDisplayUrl(media)}
						alt="预览图片"
						class="max-h-full max-w-full object-contain transition-all duration-300"
						oncontextmenu={handleContextMenu}
					/>
				</div>
			{:else}
				<div class="flex h-full w-full flex-[0_0_100%] items-center justify-center"></div>
			{/if}
		{/each}
	</div>
</div>
