/**
 * TEMP MOCK: 人测/联调占位，对接真实 IM API 后删除。
 * 关联 QA: .specs/notification/notification-im/qa/notification.tab.messages.md
 */
import type { Conversation, Message } from './types';

const now = Date.now();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

export const MOCK_CONVERSATIONS: Conversation[] = [
	{
		id: 'conv-yongzheng',
		participant: {
			id: 'user-yongzheng',
			nickname: '雍正',
			signature: '朕就是这样的汉子',
			online: true,
			following: false
		},
		lastMessageSnippet: '今晚一起打本吗？',
		lastMessageAt: iso(now - 5 * 60 * 1000),
		unreadCount: 3,
		muted: false,
		pinned: true,
		pinnedAt: iso(now - 7 * day)
	},
	{
		id: 'conv-linglong',
		participant: {
			id: 'user-linglong',
			nickname: '玲珑',
			signature: '晒你萌新一枚~',
			online: true,
			following: true
		},
		lastMessageSnippet: '好的，明天见！',
		lastMessageAt: iso(now - 2 * hour),
		unreadCount: 0,
		muted: true,
		pinned: true,
		pinnedAt: iso(now - 3 * day)
	},
	{
		id: 'conv-akira',
		participant: {
			id: 'user-akira',
			nickname: 'Akira',
			signature: 'cosplay / 摄影',
			online: false,
			following: false
		},
		lastMessageSnippet: '[图片]',
		lastMessageAt: iso(now - 26 * hour),
		unreadCount: 1,
		muted: false,
		pinned: false
	}
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
	'conv-yongzheng': [
		{
			id: 'msg-yz-1',
			conversationId: 'conv-yongzheng',
			senderId: 'user-yongzheng',
			isOwn: false,
			type: 'text',
			text: '爱新觉罗·胤禛，号雍正，清朝第五位皇帝。',
			createdAt: iso(now - 3 * day),
			status: 'sent',
			capabilities: { recall: false, edit: false }
		},
		{
			id: 'msg-yz-2',
			conversationId: 'conv-yongzheng',
			senderId: 'current-user',
			isOwn: true,
			type: 'text',
			text: '四爷好！最近有出什么新 cos 吗？',
			createdAt: iso(now - 2 * day),
			status: 'sent',
			capabilities: { recall: true, edit: true }
		},
		{
			id: 'msg-yz-3',
			conversationId: 'conv-yongzheng',
			senderId: 'user-yongzheng',
			isOwn: false,
			type: 'text',
			text: '刚拍了一组清宫主题，发你看看。',
			quote: {
				messageId: 'msg-yz-2',
				authorName: '我',
				text: '四爷好！最近有出什么新 cos 吗？'
			},
			createdAt: iso(now - 1 * day),
			status: 'sent',
			capabilities: { recall: false, edit: false }
		},
		{
			id: 'msg-yz-4',
			conversationId: 'conv-yongzheng',
			senderId: 'user-yongzheng',
			isOwn: false,
			type: 'image',
			imageUrl: undefined,
			createdAt: iso(now - 20 * hour),
			status: 'sent',
			capabilities: { recall: false, edit: false }
		},
		{
			id: 'msg-yz-5',
			conversationId: 'conv-yongzheng',
			senderId: 'user-yongzheng',
			isOwn: false,
			type: 'text',
			text: '今晚一起打本吗？',
			createdAt: iso(now - 5 * 60 * 1000),
			status: 'sent',
			capabilities: { recall: false, edit: false }
		}
	],
	'conv-linglong': [
		{
			id: 'msg-ll-1',
			conversationId: 'conv-linglong',
			senderId: 'current-user',
			isOwn: true,
			type: 'text',
			text: '漫展见！',
			createdAt: iso(now - 2 * day),
			status: 'sent',
			capabilities: { recall: true, edit: true }
		},
		{
			id: 'msg-ll-2',
			conversationId: 'conv-linglong',
			senderId: 'user-linglong',
			isOwn: false,
			type: 'text',
			text: '好的，明天见！',
			createdAt: iso(now - 2 * hour),
			status: 'sent',
			capabilities: { recall: false, edit: false }
		}
	],
	'conv-akira': [
		{
			id: 'msg-ak-1',
			conversationId: 'conv-akira',
			senderId: 'user-akira',
			isOwn: false,
			type: 'text',
			text: '这张修图好了，你看看色调。',
			createdAt: iso(now - 30 * hour),
			status: 'sent',
			capabilities: { recall: false, edit: false }
		},
		{
			id: 'msg-ak-2',
			conversationId: 'conv-akira',
			senderId: 'current-user',
			isOwn: true,
			type: 'text',
			text: '很棒！能再亮一点吗？',
			createdAt: iso(now - 28 * hour),
			status: 'sent',
			capabilities: { recall: true, edit: true }
		},
		{
			id: 'msg-ak-3',
			conversationId: 'conv-akira',
			senderId: 'user-akira',
			isOwn: false,
			type: 'image',
			imageUrl: undefined,
			createdAt: iso(now - 26 * hour),
			status: 'sent',
			capabilities: { recall: false, edit: false }
		}
	]
};
