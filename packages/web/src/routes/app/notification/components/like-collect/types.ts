export type LikeCollectActionType = 'like-post' | 'collect-post' | 'like-comment';

export interface LikeCollectNotificationUser {
	id: string;
	nickname: string;
	avatarUrl?: string;
	online?: boolean;
	verifiedTitle?: string;
	tags?: string[];
}

export interface LikeCollectNotificationItem {
	id: string;
	user: LikeCollectNotificationUser;
	actionType: LikeCollectActionType;
	createdAt: string;
	summary?: string;
	targetId: string;
	thumbnailUrl?: string;
	read: boolean;
}

export const LIKE_COLLECT_ACTION_LABELS: Record<LikeCollectActionType, string> = {
	'like-post': '赞了你的帖子',
	'collect-post': '收藏了你的帖子',
	'like-comment': '赞了你的评论'
};
