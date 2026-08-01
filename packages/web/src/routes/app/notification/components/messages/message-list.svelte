<script lang="ts">
	import type { Message } from './types';
	import type { MenuAnchor } from './types';
	import MessageItem from './message-item.svelte';

	let {
		messages,
		onOpenMessageMenu
	}: {
		messages: Message[];
		onOpenMessageMenu: (messageId: string, anchor: MenuAnchor) => void;
	} = $props();

	let listEl = $state<HTMLDivElement | null>(null);
	let shouldScrollToBottom = $state(true);

	$effect(() => {
		void messages.length;
		if (shouldScrollToBottom && listEl) {
			queueMicrotask(() => {
				if (listEl) {
					listEl.scrollTop = listEl.scrollHeight;
				}
			});
		}
	});

	function handleScroll() {
		if (!listEl) return;
		const atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 48;
		shouldScrollToBottom = atBottom;
	}
</script>

<div
	bind:this={listEl}
	class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4"
	onscroll={handleScroll}
>
	{#if messages.length === 0}
		<div class="flex flex-1 items-center justify-center text-sm text-zinc-400">
			暂无消息，发一条打个招呼吧
		</div>
	{:else}
		{#each messages as message (message.id)}
			<MessageItem {message} {onOpenMessageMenu} />
		{/each}
	{/if}
</div>
