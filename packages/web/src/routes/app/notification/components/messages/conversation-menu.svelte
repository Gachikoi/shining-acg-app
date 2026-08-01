<script lang="ts">
	import type { MessagesState } from './messages-state.svelte';

	let { state }: { state: MessagesState } = $props();

	const menu = $derived(state.conversationMenu);
	const conversation = $derived(menu ? state.findConversation(menu.conversationId) : null);

	function stopPropagation(event: MouseEvent | KeyboardEvent) {
		event.stopPropagation();
	}

	function handleReport() {
		if (!menu) return;
		state.requestReportConversation(menu.conversationId);
	}

	function handleTogglePin() {
		if (!menu) return;
		state.togglePinConversation(menu.conversationId);
	}

	function handleDelete() {
		if (!menu) return;
		state.requestDeleteConversation(menu.conversationId);
	}
</script>

{#if menu?.open && conversation}
	<div
		data-messages-menu
		class="fixed z-50 min-w-[7.5rem] rounded-xl border border-zinc-100 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
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
			onclick={handleReport}
		>
			举报
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-zinc-800 dark:text-zinc-100"
			onclick={handleTogglePin}
		>
			{conversation.pinned ? '取消置顶' : '置顶'}
		</button>
		<button
			type="button"
			role="menuitem"
			class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-red-500"
			onclick={handleDelete}
		>
			删除
		</button>
	</div>
{/if}
