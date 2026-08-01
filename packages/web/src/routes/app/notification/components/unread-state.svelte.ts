import { MOCK_CONVERSATIONS } from './messages/mock-data';
import {
	EMPTY_NOTIFICATION_UNREAD_COUNTS,
	type NotificationTabId,
	type NotificationUnreadCounts
} from './notification-tabs';

export type MarkableNotificationTabId = Exclude<NotificationTabId, 'messages' | 'system'>;

function sanitizeCount(count: number): number {
	if (!Number.isFinite(count) || count < 0) return 0;
	return Math.floor(count);
}

function initialConversationUnreads(): Record<string, number> {
	return Object.fromEntries(
		MOCK_CONVERSATIONS.map((conversation) => [conversation.id, conversation.unreadCount])
	);
}

/** 页级未读协调：会话未读聚合 messages 角标；互动 Tab 独立计数；system 不自动清零。 */
export function createUnreadState() {
	let conversationUnreads = $state<Record<string, number>>(initialConversationUnreads());
	let tabUnreads = $state<NotificationUnreadCounts>({
		...EMPTY_NOTIFICATION_UNREAD_COUNTS,
		'comment-mention': 4,
		'like-collect': 3,
		'new-follow': 3,
		system: 2
	});

	const unreadCounts = $derived.by((): NotificationUnreadCounts => {
		const messagesTotal = Object.values(conversationUnreads).reduce(
			(sum, count) => sum + sanitizeCount(count),
			0
		);
		return {
			messages: messagesTotal,
			'comment-mention': sanitizeCount(tabUnreads['comment-mention']),
			'like-collect': sanitizeCount(tabUnreads['like-collect']),
			'new-follow': sanitizeCount(tabUnreads['new-follow']),
			system: sanitizeCount(tabUnreads.system)
		};
	});

	function onConversationOpened(conversationId: string) {
		if (!(conversationId in conversationUnreads)) return;
		conversationUnreads = { ...conversationUnreads, [conversationId]: 0 };
	}

	function onTabMarkedRead(tabId: MarkableNotificationTabId) {
		if (sanitizeCount(tabUnreads[tabId]) === 0) return;
		tabUnreads = { ...tabUnreads, [tabId]: 0 };
	}

	return {
		get unreadCounts() {
			return unreadCounts;
		},
		onConversationOpened,
		onTabMarkedRead
	};
}

export type UnreadState = ReturnType<typeof createUnreadState>;
