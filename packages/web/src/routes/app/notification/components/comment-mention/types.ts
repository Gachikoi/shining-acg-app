export type CommentMentionActionType =
	| 'reply-comment'
	| 'comment-post'
	| 'mention-in-comment'
	| 'mention-in-post';

export interface CommentMentionNotificationUser {
	id: string;
	nickname: string;
	avatarUrl?: string;
	online?: boolean;
	verifiedTitle?: string;
	tags?: string[];
}

export interface CommentMentionNotificationItem {
	id: string;
	user: CommentMentionNotificationUser;
	actionType: CommentMentionActionType;
	createdAt: string;
	body?: string;
	replyQuote?: string;
	targetId: string;
	thumbnailUrl?: string;
	read: boolean;
}

export const COMMENT_MENTION_ACTION_LABELS: Record<CommentMentionActionType, string> = {
	'reply-comment': '回复了你的评论',
	'comment-post': '评论了你的帖子',
	'mention-in-comment': '在评论中@了你',
	'mention-in-post': '在帖子中@了你'
};
