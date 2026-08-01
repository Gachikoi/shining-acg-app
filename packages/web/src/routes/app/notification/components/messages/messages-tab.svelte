<script lang="ts">
	import { cn } from '$lib/utils';
	import { breakpoint } from '$lib/modules/device';
	import { createMessagesState } from './messages-state.svelte';
	import ConversationList from './conversation-list.svelte';
	import ChatPanel from './chat-panel.svelte';
	import ConversationMenu from './conversation-menu.svelte';
	import ConversationDialogs from './conversation-dialogs.svelte';
	import MessageMenu from './message-menu.svelte';

	import { MOCK_NEW_FOLLOW_ITEMS } from '../new-follow/mock-data';

	let {
		active = true,
		onConversationOpened,
		pendingDmUserId = $bindable<string | null>(null)
	}: {
		active?: boolean;
		onConversationOpened?: (conversationId: string) => void;
		pendingDmUserId?: string | null;
	} = $props();

	const state = createMessagesState({ onConversationOpened });
	const isNarrow = $derived(!breakpoint.isMd);
	const showListPane = $derived(!isNarrow || !state.showChatDetail);
	const showChatPane = $derived(!isNarrow || state.showChatDetail);

	$effect(() => {
		const userId = pendingDmUserId;
		if (!active || !userId) return;
		const followItem = MOCK_NEW_FOLLOW_ITEMS.find((item) => item.user.id === userId);
		state.openConversationForUser(userId, isNarrow, followItem?.user);
		pendingDmUserId = null;
	});

	function handleWindowClick(event: MouseEvent) {
		const target = event.target;
		if (target instanceof Element && target.closest('[data-messages-menu]')) {
			return;
		}
		state.closeAllMenus();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (state.messageMenu) {
				state.closeMessageMenu();
			} else if (state.conversationMenu) {
				state.closeConversationMenu();
			} else if (state.swipeOpenId) {
				state.closeSwipeActions();
			}
		}
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div
	id="notification-panel-messages"
	role="tabpanel"
	aria-labelledby="notification-tab-messages"
	hidden={!active}
	class="h-full min-h-0"
>
	<div class="flex h-full min-h-0 overflow-hidden">
		{#if showListPane}
			<div
				class={cn(
					'flex h-full min-h-0 flex-col border-zinc-100 dark:border-zinc-800',
					isNarrow ? 'w-full' : 'w-[min(100%,22rem)] shrink-0 basis-[35%] border-r'
				)}
			>
				<ConversationList {state} {isNarrow} />
			</div>
		{/if}

		{#if showChatPane}
			<div class={cn('flex h-full min-h-0 min-w-0 flex-col', isNarrow ? 'w-full' : 'flex-1')}>
				{#if state.activeConversation}
					<ChatPanel {state} {isNarrow} />
				{:else}
					<div class="flex flex-1 items-center justify-center text-zinc-300 dark:text-zinc-600">
						<p class="px-4 text-center text-base">快找小伙伴聊天吧 ( · - · )つ口</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<ConversationMenu {state} />
	<ConversationDialogs {state} />
	<MessageMenu {state} />
</div>
