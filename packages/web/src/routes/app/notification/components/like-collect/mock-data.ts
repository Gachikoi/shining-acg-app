/**
 * TEMP MOCK: 人测/联调占位，对接真实通知 API 后删除。
 * 关联 QA: .specs/notification/notification-im/qa/notification.tab.like-collect.md
 */
import type { LikeCollectNotificationItem } from './types';

const now = Date.now();
const hour = 60 * 60 * 1000;

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

export const MOCK_LIKE_COLLECT_ITEMS: LikeCollectNotificationItem[] = [
	{
		id: 'lc-1',
		user: {
			id: 'user-sora',
			nickname: 'Sora',
			online: true,
			tags: ['Coser']
		},
		actionType: 'like-post',
		createdAt: iso(now - 20 * 60 * 1000),
		summary: '「漫展 Day1 场照合集」',
		targetId: 'post-201',
		read: false
	},
	{
		id: 'lc-2',
		user: {
			id: 'user-yui',
			nickname: 'Yui',
			online: false,
			verifiedTitle: '认证摄影师'
		},
		actionType: 'collect-post',
		createdAt: iso(now - 2 * hour),
		summary: '「原神芙宁娜 cos 正片」',
		targetId: 'post-202',
		read: false
	},
	{
		id: 'lc-3',
		user: {
			id: 'user-leo',
			nickname: 'Leo',
			online: true
		},
		actionType: 'like-comment',
		createdAt: iso(now - 5 * hour),
		summary: '这套妆面细节太棒了！',
		targetId: 'comment-301',
		read: false
	}
];
