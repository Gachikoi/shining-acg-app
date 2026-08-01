<script lang="ts">
	import NotificationShell from './components/notification-shell.svelte';
	import NotificationTabs from './components/notification-tabs.svelte';
	import NotificationResponsive from './components/notification-responsive.svelte';
	import MessagesTab from './components/messages/messages-tab.svelte';
	import CommentMentionTab from './components/comment-mention/comment-mention-tab.svelte';
	import LikeCollectTab from './components/like-collect/like-collect-tab.svelte';
	import NewFollowTab from './components/new-follow/new-follow-tab.svelte';
	import SystemTab from './components/system/system-tab.svelte';
	import {
		createUnreadState,
		type MarkableNotificationTabId
	} from './components/unread-state.svelte';
	import { type NotificationTabId } from './components/notification-tabs';

	let activeTab = $state<NotificationTabId>('messages');
	let pendingDmUserId = $state<string | null>(null);

	const unreadState = createUnreadState();

	function handleTabMarkedRead(tabId: MarkableNotificationTabId) {
		unreadState.onTabMarkedRead(tabId);
	}

	function handleStartDm(userId: string) {
		activeTab = 'messages';
		pendingDmUserId = userId;
	}

	function handleFollowBack(_userId: string) {
		// TODO: 对接真实关注 API
	}
</script>

<NotificationShell>
	{#snippet tabs()}
		<NotificationTabs bind:activeTab unreadCounts={unreadState.unreadCounts} />
	{/snippet}

	<NotificationResponsive>
		<MessagesTab
			active={activeTab === 'messages'}
			onConversationOpened={unreadState.onConversationOpened}
			bind:pendingDmUserId
		/>

		<CommentMentionTab
			active={activeTab === 'comment-mention'}
			onTabMarkedRead={() => handleTabMarkedRead('comment-mention')}
		/>

		<LikeCollectTab
			active={activeTab === 'like-collect'}
			onTabMarkedRead={() => handleTabMarkedRead('like-collect')}
		/>

		<NewFollowTab
			active={activeTab === 'new-follow'}
			onTabMarkedRead={() => handleTabMarkedRead('new-follow')}
			onStartDm={handleStartDm}
			onFollowBack={handleFollowBack}
		/>

		<SystemTab active={activeTab === 'system'} />
	</NotificationResponsive>
</NotificationShell>
