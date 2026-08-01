import type { NewFollowNotificationItem } from './types';

const now = Date.now();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

export const MOCK_NEW_FOLLOW_ITEMS: NewFollowNotificationItem[] = [
	{
		id: 'nf-1',
		user: {
			id: 'user-nagi',
			nickname: 'Nagi',
			online: true,
			tags: ['摄影', '后期'],
			signature: '欢迎互关～'
		},
		createdAt: iso(now - 30 * 60 * 1000),
		relation: 'none',
		read: false
	},
	{
		id: 'nf-2',
		user: {
			id: 'user-aoi',
			nickname: 'Aoi',
			online: false,
			verifiedTitle: '认证Coser'
		},
		createdAt: iso(now - 4 * hour),
		relation: 'following',
		read: false
	},
	{
		id: 'nf-3',
		user: {
			id: 'user-rin',
			nickname: 'Rin',
			online: true,
			tags: ['晒你萌新']
		},
		createdAt: iso(now - 2 * day),
		relation: 'mutual',
		read: false
	}
];
