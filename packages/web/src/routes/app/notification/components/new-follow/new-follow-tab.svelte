<script lang="ts">
	import { untrack } from 'svelte';
	import { StateFeedback } from '../shared';
	import NewFollowItem from './item.svelte';
	import { MOCK_NEW_FOLLOW_ITEMS } from './mock-data';
	import type { NewFollowNotificationItem } from './types';

	let {
		active = false,
		onTabMarkedRead,
		onStartDm,
		onFollowBack
	}: {
		active?: boolean;
		onTabMarkedRead?: () => void;
		onStartDm?: (userId: string) => void;
		onFollowBack?: (userId: string) => void;
	} = $props();

	let items = $state<NewFollowNotificationItem[]>(structuredClone(MOCK_NEW_FOLLOW_ITEMS));
	let loading = $state(false);
	let error = $state(false);

	const hasItems = $derived(items.length > 0);

	function markAllRead() {
		items = items.map((item) => ({ ...item, read: true }));
	}

	function handleFollowBack(userId: string) {
		items = items.map((item) =>
			item.user.id === userId ? { ...item, relation: 'following' as const } : item
		);
		onFollowBack?.(userId);
	}

	function handleRetryLoad() {
		error = false;
		loading = true;
		setTimeout(() => {
			loading = false;
			items = structuredClone(MOCK_NEW_FOLLOW_ITEMS);
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
	id="notification-panel-new-follow"
	role="tabpanel"
	aria-labelledby="notification-tab-new-follow"
	hidden={!active}
	class="h-full overflow-y-auto"
>
	{#if loading}
		<StateFeedback variant="loading" />
	{:else if error}
		<StateFeedback variant="error" onRetry={handleRetryLoad} />
	{:else if !hasItems}
		<StateFeedback variant="empty" message="暂无新增关注" />
	{:else}
		<div class="divide-y divide-zinc-100 dark:divide-zinc-800">
			{#each items as item (item.id)}
				<NewFollowItem {item} {onStartDm} onFollowBack={handleFollowBack} />
			{/each}
		</div>
	{/if}
</div>
