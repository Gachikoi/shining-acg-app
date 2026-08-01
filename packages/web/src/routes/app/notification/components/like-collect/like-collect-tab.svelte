<script lang="ts">
	import { untrack } from 'svelte';
	import { StateFeedback } from '../shared';
	import LikeCollectItem from './item.svelte';
	import { MOCK_LIKE_COLLECT_ITEMS } from './mock-data';
	import type { LikeCollectNotificationItem } from './types';

	let {
		active = false,
		onTabMarkedRead
	}: {
		active?: boolean;
		onTabMarkedRead?: () => void;
	} = $props();

	let items = $state<LikeCollectNotificationItem[]>(structuredClone(MOCK_LIKE_COLLECT_ITEMS));
	let loading = $state(false);
	let error = $state(false);

	const hasItems = $derived(items.length > 0);

	function markAllRead() {
		items = items.map((item) => ({ ...item, read: true }));
	}

	function handleRetryLoad() {
		error = false;
		loading = true;
		setTimeout(() => {
			loading = false;
			items = structuredClone(MOCK_LIKE_COLLECT_ITEMS);
		}, 300);
	}

	// 仅订阅 active；markAllRead / 回调写状态时用 untrack，避免 $effect 自触发死循环
	$effect(() => {
		if (!active) return;
		untrack(() => {
			onTabMarkedRead?.();
			markAllRead();
		});
	});
</script>

<div
	id="notification-panel-like-collect"
	role="tabpanel"
	aria-labelledby="notification-tab-like-collect"
	hidden={!active}
	class="h-full overflow-y-auto"
>
	{#if loading}
		<StateFeedback variant="loading" />
	{:else if error}
		<StateFeedback variant="error" onRetry={handleRetryLoad} />
	{:else if !hasItems}
		<StateFeedback variant="empty" message="暂无赞和收藏通知" />
	{:else}
		<div class="divide-y divide-zinc-100 dark:divide-zinc-800">
			{#each items as item (item.id)}
				<LikeCollectItem {item} />
			{/each}
		</div>
	{/if}
</div>
