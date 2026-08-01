import type { CommentMentionNotificationItem } from './types';

const now = Date.now();
const hour = 60 * 60 * 1000;

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

export const MOCK_COMMENT_MENTION_ITEMS: CommentMentionNotificationItem[] = [
	{
		id: 'cm-1',
		user: {
			id: 'user-hana',
			nickname: '花凛',
			online: true,
			verifiedTitle: '官方认证',
			tags: ['摄影']
		},
		actionType: 'reply-comment',
		createdAt: iso(now - 12 * 60 * 1000),
		body: '同感！这套 cos 的配色太绝了。',
		replyQuote: '这次漫展的场照终于修完了～',
		targetId: 'post-101',
		thumbnailUrl: undefined,
		read: false
	},
	{
		id: 'cm-2',
		user: {
			id: 'user-kaito',
			nickname: 'Kaito',
			online: false,
			tags: ['原神', '同人']
		},
		actionType: 'comment-post',
		createdAt: iso(now - 45 * 60 * 1000),
		body: '求出教程！妆面好干净。',
		targetId: 'post-102',
		thumbnailUrl: undefined,
		read: false
	},
	{
		id: 'cm-3',
		user: {
			id: 'user-momo',
			nickname: 'Momo',
			online: true
		},
		actionType: 'mention-in-comment',
		createdAt: iso(now - 3 * hour),
		body: '@你 来看看这个分镜对不对？',
		replyQuote: '第三幕的打光我想再调一下',
		targetId: 'post-103',
		read: false
	},
	{
		id: 'cm-4',
		user: {
			id: 'user-ren',
			nickname: 'Ren',
			online: false,
			tags: ['晒你萌新']
		},
		actionType: 'mention-in-post',
		createdAt: iso(now - 6 * hour),
		body: '@你 周末组局缺一个摄影，有空吗？',
		targetId: 'post-104',
		read: true
	}
];
