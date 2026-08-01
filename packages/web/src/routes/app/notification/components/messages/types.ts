/** 本地 IM 模型（独立于生成 API，便于后续适配层替换） */

export type MessageStatus = 'sending' | 'sent' | 'failed';

export type MessageType = 'text' | 'image';

export interface MessageCapabilities {
	recall: boolean;
	edit: boolean;
}

export interface MessageQuote {
	messageId: string;
	authorName: string;
	text: string;
}

export interface Message {
	id: string;
	conversationId: string;
	senderId: string;
	isOwn: boolean;
	type: MessageType;
	text?: string;
	/** 本地预览 URL（Object URL 或静态占位） */
	imageUrl?: string;
	quote?: MessageQuote;
	createdAt: string;
	status: MessageStatus;
	capabilities: MessageCapabilities;
	recalled?: boolean;
}

export interface ConversationParticipant {
	id: string;
	nickname: string;
	avatarUrl?: string;
	signature?: string;
	online: boolean;
	following: boolean;
}

export interface Conversation {
	id: string;
	participant: ConversationParticipant;
	lastMessageSnippet: string;
	lastMessageAt: string;
	unreadCount: number;
	muted: boolean;
	pinned: boolean;
	/** 置顶组内稳定排序 */
	pinnedAt?: string;
}

export type ConversationDialogType = 'report' | 'delete';

export interface MenuAnchor {
	x: number;
	y: number;
}

export interface ConversationMenuState {
	open: boolean;
	conversationId: string;
	anchor: MenuAnchor;
}

export interface MessageMenuState {
	open: boolean;
	messageId: string;
	anchor: MenuAnchor;
}
