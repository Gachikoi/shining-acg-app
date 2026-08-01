export type NewFollowRelation = 'none' | 'following' | 'mutual' | 'unknown';

export interface NewFollowNotificationUser {
	id: string;
	nickname: string;
	avatarUrl?: string;
	online?: boolean;
	verifiedTitle?: string;
	tags?: string[];
	signature?: string;
}

export interface NewFollowNotificationItem {
	id: string;
	user: NewFollowNotificationUser;
	createdAt: string;
	relation: NewFollowRelation;
	read: boolean;
}
