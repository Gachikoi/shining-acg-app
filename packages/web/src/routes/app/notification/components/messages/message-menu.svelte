<script lang="ts">
	import type { MessagesState } from './messages-state.svelte';

	let { state }: { state: MessagesState } = $props();

	const menu = $derived(state.messageMenu);
	const message = $derived(state.activeMessage);

	function stopPropagation(event: MouseEvent | KeyboardEvent) {
		event.stopPropagation();
	}

	const showRecall = $derived(message?.isOwn && message.capabilities.recall && !message.recalled);
	const showEdit = $derived(
		message?.isOwn && message.capabilities.edit && !message.recalled && message.type === 'text'
	);
</script>

{#if menu?.open && message}
	<div
		data-messages-menu
		class="fixed z-50 rounded-xl border border-zinc-100 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
		style:left="{menu.anchor.x}px"
		style:top="{menu.anchor.y}px"
		role="menu"
		tabindex="-1"
		onclick={stopPropagation}
		onkeydown={stopPropagation}
	>
		<button
			type="button"
			role="menuitem"
			class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-zinc-800 dark:text-zinc-100"
			onclick={() => state.copyMessage(message.id)}
		>
			复制
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-zinc-800 dark:text-zinc-100"
			disabled={message.recalled}
			class:opacity-40={message.recalled}
			class:pointer-events-none={message.recalled}
			onclick={() => state.quoteMessage(message.id)}
		>
			引用
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-zinc-800 dark:text-zinc-100"
			class:opacity-40={!showRecall}
			class:pointer-events-none={!showRecall}
			disabled={!showRecall}
			onclick={() => state.recallMessage(message.id)}
		>
			撤回
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-zinc-800 dark:text-zinc-100"
			class:opacity-40={!showEdit}
			class:pointer-events-none={!showEdit}
			disabled={!showEdit}
			onclick={() => state.editMessage(message.id)}
		>
			编辑
		</button>
	</div>
{/if}
