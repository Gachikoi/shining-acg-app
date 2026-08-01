<script lang="ts">
	import type { MessagesState } from './messages-state.svelte';
	import ConversationItem from './conversation-item.svelte';

	let {
		state,
		isNarrow
	}: {
		state: MessagesState;
		isNarrow: boolean;
	} = $props();
</script>

<div class="flex h-full min-h-0 flex-col">
	<div class="flex h-full min-h-0 flex-col overflow-y-auto">
		{#if state.sortedConversations.length === 0}
			<div
				class="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-zinc-400"
			>
				暂无会话
			</div>
		{:else}
			{#each state.sortedConversations as conversation (conversation.id)}
				<ConversationItem
					{conversation}
					selected={state.activeConversationId === conversation.id}
					swipeOpen={state.swipeOpenId === conversation.id}
					onSelect={() => state.selectConversation(conversation.id, isNarrow)}
					onOpenMenu={(anchor) => state.openConversationMenu(conversation.id, anchor)}
					onRevealActions={() => state.revealConversationActions(conversation.id)}
					onReport={() => state.requestReportConversation(conversation.id)}
					onTogglePin={() => state.togglePinConversation(conversation.id)}
					onDelete={() => state.requestDeleteConversation(conversation.id)}
					onCloseSwipe={() => state.closeSwipeActions()}
				/>
			{/each}
		{/if}
	</div>
</div>
