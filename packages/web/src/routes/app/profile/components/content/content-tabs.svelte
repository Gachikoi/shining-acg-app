<script lang="ts">
	import { Lock } from 'lucide-svelte';
	import type { ProfileContentTabId } from '../types';

	let {
		activeTab = $bindable('favorites' as ProfileContentTabId),
		onTabChange
	}: {
		activeTab?: ProfileContentTabId;
		onTabChange?: (tabId: ProfileContentTabId) => void;
	} = $props();

	const tabs: { id: ProfileContentTabId; label: string; locked: boolean }[] = [
		{ id: 'posts', label: '帖子', locked: false },
		{ id: 'favorites', label: '收藏', locked: true },
		{ id: 'likes', label: '点赞', locked: true }
	];

	function select(tabId: ProfileContentTabId) {
		activeTab = tabId;
		onTabChange?.(tabId);
	}

	function onKeydown(e: KeyboardEvent, index: number) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		const delta = e.key === 'ArrowRight' ? 1 : -1;
		const next = (index + delta + tabs.length) % tabs.length;
		select(tabs[next].id);
	}
</script>

<div
	class="flex min-h-11 flex-wrap items-center justify-center gap-2"
	role="tablist"
	aria-label="内容分类"
>
	{#each tabs as tab, index (tab.id)}
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === tab.id}
			tabindex={activeTab === tab.id ? 0 : -1}
			class="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 {activeTab ===
			tab.id
				? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
				: 'bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}"
			onclick={() => select(tab.id)}
			onkeydown={(e) => onKeydown(e, index)}
		>
			{#if tab.locked}
				<Lock class="size-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
			{/if}
			{tab.label}
		</button>
	{/each}
</div>
