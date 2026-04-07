<!--
  @component FeedPullHeader
  下拉刷新顶部指示：正在刷新 / 释放刷新 / 下拉刷新 + 旋转进度。
-->
<script lang="ts">
	import { Spinner } from '$lib/components/ui/spinner';
	import type { FeedStreamConfig } from '$lib/modules/gesture';

	let {
		refreshing = false,
		elasticPx = 0,
		elasticConfig
	}: {
		refreshing?: boolean;
		/** 当前弹性位移（px） */
		elasticPx?: number;
		/** 已由父级 `resolveFeedStreamConfig` 合并默认后的完整配置 */
		elasticConfig: FeedStreamConfig;
	} = $props();
</script>

<div class="flex h-4 items-end justify-center">
	{#if refreshing}
		<Spinner class="mr-2 text-primary" />
		<span class="text-sm text-muted-foreground">正在刷新</span>
	{:else if elasticPx >= elasticConfig.triggerThreshold}
		<div
			class="mr-2 text-primary"
			style="transform: rotate({Math.min(
				(elasticPx / elasticConfig.triggerThreshold) * 360,
				360
			)}deg);"
		>
			<Spinner class="animate-none!" />
		</div>
		<span class="text-sm text-muted-foreground">释放刷新</span>
	{:else}
		<div
			class="mr-2 text-primary"
			style="transform: rotate({Math.min(
				(elasticPx / elasticConfig.triggerThreshold) * 360,
				360
			)}deg);"
		>
			<Spinner class="animate-none!" />
		</div>
		<span class="text-sm text-muted-foreground">下拉刷新</span>
	{/if}
</div>
