<script lang="ts">
	import type { MessagesState } from './messages-state.svelte';
	import ChatHeader from './chat-header.svelte';
	import MessageList from './message-list.svelte';
	import Composer from './composer.svelte';

	let {
		state,
		isNarrow
	}: {
		state: MessagesState;
		isNarrow: boolean;
	} = $props();

	const conversation = $derived(state.activeConversation);
</script>

{#if conversation}
	<div class="flex h-full min-h-0 flex-col">
		<ChatHeader
			{conversation}
			threadSearchOpen={state.threadSearchOpen}
			threadSearchQuery={state.threadSearchQuery}
			{isNarrow}
			onBack={() => state.backToList()}
			onToggleFollow={() => state.toggleFollow(conversation.participant.id)}
			onToggleThreadSearch={(open) => state.toggleThreadSearch(open)}
			onThreadSearchQueryChange={(q) => state.setThreadSearchQuery(q)}
			onOpenMenu={(anchor) => state.openConversationMenu(conversation.id, anchor)}
		/>
		<MessageList
			messages={state.activeMessages}
			onOpenMessageMenu={(messageId, anchor) => state.openMessageMenu(messageId, anchor)}
		/>
		<Composer
			quote={state.composerQuote}
			editingMessageId={state.editingMessageId}
			messages={state.messagesByConversationId[conversation.id] ?? []}
			onSendText={(text) => state.sendText(text)}
			onClearMeta={() => state.clearComposerMeta()}
			onPickImage={(url) => state.addLocalImagePreview(conversation.id, url)}
		/>
	</div>
{/if}
