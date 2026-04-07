<!--
  @component FeedStreamFooter
  Feed 流底部：加载中 / 没有更多。与上文间距由宿主布局控制。
-->
<script lang="ts">
	import { Spinner } from '$lib/components/ui/spinner';

	let {
		loading = false,
		hasMore = true,
		itemCount = 0
	}: {
		loading?: boolean;
		hasMore?: boolean;
		itemCount?: number;
	} = $props();
</script>

{#if loading && itemCount > 0}
	<div class="flex items-center justify-center py-4">
		<Spinner class="mr-2 text-primary" />
		<span class="text-sm text-muted-foreground">加载中</span>
	</div>
{:else if loading}
	<div class="py-4 text-center text-sm text-muted-foreground">加载中...</div>
{:else if !hasMore && itemCount > 0}
	<div class="py-4 text-center text-sm text-muted-foreground">没有更多了</div>
{/if}
