import { toast } from 'svelte-sonner';
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from './mock-data';
import type {
	Conversation,
	ConversationDialogType,
	ConversationMenuState,
	Message,
	MessageMenuState,
	MessageQuote,
	MenuAnchor
} from './types';

export function sortConversations(list: Conversation[]): Conversation[] {
	return [...list].sort((a, b) => {
		if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
		if (a.pinned && b.pinned) {
			const pa = a.pinnedAt ?? a.lastMessageAt;
			const pb = b.pinnedAt ?? b.lastMessageAt;
			return pb.localeCompare(pa);
		}
		return b.lastMessageAt.localeCompare(a.lastMessageAt);
	});
}

function cloneMessages(map: Record<string, Message[]>): Record<string, Message[]> {
	const next: Record<string, Message[]> = {};
	for (const [key, value] of Object.entries(map)) {
		next[key] = value.map((m) => ({
			...m,
			capabilities: { ...m.capabilities },
			quote: m.quote ? { ...m.quote } : undefined
		}));
	}
	return next;
}

let messageIdCounter = 1000;

function nextMessageId(): string {
	messageIdCounter += 1;
	return `msg-local-${messageIdCounter}`;
}

export type MessagesStateOptions = {
	onConversationOpened?: (conversationId: string) => void;
};

export function createMessagesState(options: MessagesStateOptions = {}) {
	let conversations = $state<Conversation[]>(
		sortConversations(structuredClone(MOCK_CONVERSATIONS))
	);
	let messagesByConversationId = $state<Record<string, Message[]>>(cloneMessages(MOCK_MESSAGES));
	let activeConversationId = $state<string | null>(null);
	let showChatDetail = $state(false);
	let conversationMenu = $state<ConversationMenuState | null>(null);
	let swipeOpenId = $state<string | null>(null);
	let dialogType = $state<ConversationDialogType | null>(null);
	let dialogTargetId = $state<string | null>(null);
	let messageMenu = $state<MessageMenuState | null>(null);
	let threadSearchOpen = $state(false);
	let threadSearchQuery = $state('');
	let composerQuote = $state<MessageQuote | null>(null);
	let editingMessageId = $state<string | null>(null);

	const sortedConversations = $derived(sortConversations(conversations));

	const activeConversation = $derived(
		activeConversationId ? (conversations.find((c) => c.id === activeConversationId) ?? null) : null
	);

	const activeMessages = $derived.by(() => {
		if (!activeConversationId) return [];
		const list = messagesByConversationId[activeConversationId] ?? [];
		const query = threadSearchQuery.trim().toLowerCase();
		if (!threadSearchOpen || !query) return list;
		return list.filter((m) => {
			if (m.recalled) return false;
			if (m.type === 'text' && m.text?.toLowerCase().includes(query)) return true;
			if (m.quote?.text.toLowerCase().includes(query)) return true;
			return false;
		});
	});

	const activeMessage = $derived(messageMenu ? (findMessage(messageMenu.messageId) ?? null) : null);

	function findMessage(messageId: string): Message | undefined {
		for (const list of Object.values(messagesByConversationId)) {
			const found = list.find((m) => m.id === messageId);
			if (found) return found;
		}
		return undefined;
	}

	function findConversation(conversationId: string): Conversation | undefined {
		return conversations.find((c) => c.id === conversationId);
	}

	function updateConversationSnippet(conversationId: string, snippet: string, at: string) {
		conversations = conversations.map((c) =>
			c.id === conversationId ? { ...c, lastMessageSnippet: snippet, lastMessageAt: at } : c
		);
	}

	function selectConversation(conversationId: string, narrowScreen: boolean) {
		closeAllMenus();
		activeConversationId = conversationId;
		conversations = conversations.map((c) =>
			c.id === conversationId ? { ...c, unreadCount: 0 } : c
		);
		options.onConversationOpened?.(conversationId);
		if (narrowScreen) {
			showChatDetail = true;
		}
	}

	function openConversationForUser(
		userId: string,
		narrowScreen: boolean,
		participantOverride?: Partial<Conversation['participant']>
	) {
		const existing = conversations.find((c) => c.participant.id === userId);
		if (existing) {
			selectConversation(existing.id, narrowScreen);
			return existing.id;
		}

		const now = new Date().toISOString();
		const participant: Conversation['participant'] = {
			id: userId,
			nickname: participantOverride?.nickname ?? userId,
			avatarUrl: participantOverride?.avatarUrl,
			signature: participantOverride?.signature,
			online: participantOverride?.online ?? false,
			following: participantOverride?.following ?? false
		};
		const newConversation: Conversation = {
			id: `conv-local-${userId}`,
			participant,
			lastMessageSnippet: '',
			lastMessageAt: now,
			unreadCount: 0,
			muted: false,
			pinned: false
		};

		conversations = sortConversations([...conversations, newConversation]);
		messagesByConversationId = {
			...messagesByConversationId,
			[newConversation.id]: []
		};
		selectConversation(newConversation.id, narrowScreen);
		return newConversation.id;
	}

	function backToList() {
		showChatDetail = false;
		closeAllMenus();
	}

	function openConversationMenu(conversationId: string, anchor: MenuAnchor) {
		swipeOpenId = null;
		conversationMenu = { open: true, conversationId, anchor };
		messageMenu = null;
	}

	function closeConversationMenu() {
		conversationMenu = null;
	}

	function revealConversationActions(conversationId: string) {
		conversationMenu = null;
		messageMenu = null;
		swipeOpenId = conversationId;
	}

	function closeSwipeActions() {
		swipeOpenId = null;
	}

	function closeAllMenus() {
		conversationMenu = null;
		messageMenu = null;
		swipeOpenId = null;
	}

	function requestReportConversation(conversationId: string) {
		closeConversationMenu();
		closeSwipeActions();
		dialogType = 'report';
		dialogTargetId = conversationId;
	}

	function requestDeleteConversation(conversationId: string) {
		closeConversationMenu();
		closeSwipeActions();
		dialogType = 'delete';
		dialogTargetId = conversationId;
	}

	function cancelDialog() {
		dialogType = null;
		dialogTargetId = null;
	}

	function confirmReport(conversationId: string) {
		// TODO: 对接真实举报 API
		toast.success('举报已提交，我们会尽快处理');
		dialogType = null;
		dialogTargetId = null;
		void conversationId;
	}

	function confirmDelete(conversationId: string) {
		const wasActive = activeConversationId === conversationId;
		const remaining = conversations.filter((c) => c.id !== conversationId);
		conversations = sortConversations(remaining);
		const { [conversationId]: _removed, ...rest } = messagesByConversationId;
		messagesByConversationId = rest;

		if (wasActive) {
			const next = remaining[0]?.id ?? null;
			activeConversationId = next;
			if (!next) {
				showChatDetail = false;
			}
		}

		dialogType = null;
		dialogTargetId = null;
		toast.success('会话已删除');
	}

	function togglePinConversation(conversationId: string) {
		closeConversationMenu();
		closeSwipeActions();
		conversations = sortConversations(
			conversations.map((c) => {
				if (c.id !== conversationId) return c;
				const pinned = !c.pinned;
				return {
					...c,
					pinned,
					pinnedAt: pinned ? new Date().toISOString() : undefined
				};
			})
		);
		const conv = findConversation(conversationId);
		toast.success(conv?.pinned ? '已置顶' : '已取消置顶');
	}

	function toggleFollow(userId: string) {
		conversations = conversations.map((c) =>
			c.participant.id === userId
				? { ...c, participant: { ...c.participant, following: !c.participant.following } }
				: c
		);
		// TODO: 对接真实关注 API
		const conv = conversations.find((c) => c.participant.id === userId);
		if (conv) {
			toast.success(conv.participant.following ? '已关注' : '已取消关注');
		}
	}

	function toggleThreadSearch(open?: boolean) {
		threadSearchOpen = open ?? !threadSearchOpen;
		if (!threadSearchOpen) {
			threadSearchQuery = '';
		}
	}

	function setThreadSearchQuery(query: string) {
		threadSearchQuery = query;
	}

	function openMessageMenu(messageId: string, anchor: MenuAnchor) {
		conversationMenu = null;
		swipeOpenId = null;
		messageMenu = { open: true, messageId, anchor };
	}

	function closeMessageMenu() {
		messageMenu = null;
	}

	async function copyMessage(messageId: string) {
		const message = findMessage(messageId);
		closeMessageMenu();
		if (!message || message.recalled) return;
		const text = message.type === 'text' ? message.text : message.type === 'image' ? '[图片]' : '';
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			toast.success('已复制');
		} catch {
			toast.error('复制失败，请重试');
		}
	}

	function quoteMessage(messageId: string) {
		const message = findMessage(messageId);
		closeMessageMenu();
		if (!message || message.recalled) return;
		const authorName = message.isOwn
			? '我'
			: (findConversation(message.conversationId)?.participant.nickname ?? '对方');
		const text =
			message.type === 'text' ? (message.text ?? '') : message.type === 'image' ? '[图片]' : '';
		composerQuote = { messageId, authorName, text };
		editingMessageId = null;
	}

	function recallMessage(messageId: string) {
		const message = findMessage(messageId);
		closeMessageMenu();
		if (!message?.isOwn || !message.capabilities.recall || message.recalled) return;

		const list = messagesByConversationId[message.conversationId];
		if (!list) return;

		messagesByConversationId = {
			...messagesByConversationId,
			[message.conversationId]: list.map((m) =>
				m.id === messageId ? { ...m, recalled: true, text: '你撤回了一条消息' } : m
			)
		};
		updateConversationSnippet(message.conversationId, '你撤回了一条消息', new Date().toISOString());
		toast.success('消息已撤回');
	}

	function editMessage(messageId: string) {
		const message = findMessage(messageId);
		closeMessageMenu();
		if (
			!message?.isOwn ||
			!message.capabilities.edit ||
			message.recalled ||
			message.type !== 'text'
		) {
			return;
		}
		editingMessageId = messageId;
		composerQuote = null;
	}

	function clearComposerMeta() {
		composerQuote = null;
		editingMessageId = null;
	}

	function sendText(text: string) {
		if (!activeConversationId) return;
		const trimmed = text.trim();
		if (!trimmed) return;

		const now = new Date().toISOString();

		if (editingMessageId) {
			const list = messagesByConversationId[activeConversationId] ?? [];
			messagesByConversationId = {
				...messagesByConversationId,
				[activeConversationId]: list.map((m) =>
					m.id === editingMessageId ? { ...m, text: trimmed, createdAt: now } : m
				)
			};
			updateConversationSnippet(activeConversationId, trimmed, now);
			editingMessageId = null;
			composerQuote = null;
			return;
		}

		const newMessage: Message = {
			id: nextMessageId(),
			conversationId: activeConversationId,
			senderId: 'current-user',
			isOwn: true,
			type: 'text',
			text: trimmed,
			quote: composerQuote ?? undefined,
			createdAt: now,
			status: 'sent',
			capabilities: { recall: true, edit: true }
		};

		const list = messagesByConversationId[activeConversationId] ?? [];
		messagesByConversationId = {
			...messagesByConversationId,
			[activeConversationId]: [...list, newMessage]
		};
		updateConversationSnippet(activeConversationId, trimmed, now);
		composerQuote = null;
	}

	function addLocalImagePreview(conversationId: string, imageUrl: string) {
		const now = new Date().toISOString();
		const newMessage: Message = {
			id: nextMessageId(),
			conversationId,
			senderId: 'current-user',
			isOwn: true,
			type: 'image',
			imageUrl,
			createdAt: now,
			status: 'sent',
			capabilities: { recall: true, edit: false }
		};
		const list = messagesByConversationId[conversationId] ?? [];
		messagesByConversationId = {
			...messagesByConversationId,
			[conversationId]: [...list, newMessage]
		};
		updateConversationSnippet(conversationId, '[图片]', now);
	}

	return {
		get conversations() {
			return conversations;
		},
		get sortedConversations() {
			return sortedConversations;
		},
		get messagesByConversationId() {
			return messagesByConversationId;
		},
		get activeConversationId() {
			return activeConversationId;
		},
		set activeConversationId(value: string | null) {
			activeConversationId = value;
		},
		get showChatDetail() {
			return showChatDetail;
		},
		get conversationMenu() {
			return conversationMenu;
		},
		get swipeOpenId() {
			return swipeOpenId;
		},
		get dialogType() {
			return dialogType;
		},
		get dialogTargetId() {
			return dialogTargetId;
		},
		get messageMenu() {
			return messageMenu;
		},
		get threadSearchOpen() {
			return threadSearchOpen;
		},
		get threadSearchQuery() {
			return threadSearchQuery;
		},
		get composerQuote() {
			return composerQuote;
		},
		get editingMessageId() {
			return editingMessageId;
		},
		get activeConversation() {
			return activeConversation;
		},
		get activeMessages() {
			return activeMessages;
		},
		get activeMessage() {
			return activeMessage;
		},
		selectConversation,
		openConversationForUser,
		backToList,
		openConversationMenu,
		closeConversationMenu,
		revealConversationActions,
		closeSwipeActions,
		closeAllMenus,
		requestReportConversation,
		requestDeleteConversation,
		cancelDialog,
		confirmReport,
		confirmDelete,
		togglePinConversation,
		toggleFollow,
		toggleThreadSearch,
		setThreadSearchQuery,
		openMessageMenu,
		closeMessageMenu,
		copyMessage,
		quoteMessage,
		recallMessage,
		editMessage,
		clearComposerMeta,
		sendText,
		addLocalImagePreview,
		findConversation
	};
}

export type MessagesState = ReturnType<typeof createMessagesState>;
