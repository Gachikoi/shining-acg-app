export type NotificationTabId =
	| 'messages'
	| 'comment-mention'
	| 'like-collect'
	| 'new-follow'
	| 'system';

export type NotificationTabTone = 'amber' | 'emerald' | 'red' | 'sky' | 'zinc';

export type NotificationTabDefinition = {
	id: NotificationTabId;
	label: string;
	tone: NotificationTabTone;
};

/** 固定顺序：我的消息 → 评论和@ → 赞和收藏 → 新增关注 → 晒你通知 */
export const NOTIFICATION_TABS: readonly NotificationTabDefinition[] = [
	{ id: 'messages', label: '我的消息', tone: 'amber' },
	{ id: 'comment-mention', label: '评论和@', tone: 'emerald' },
	{ id: 'like-collect', label: '赞和收藏', tone: 'red' },
	{ id: 'new-follow', label: '新增关注', tone: 'sky' },
	{ id: 'system', label: '晒你通知', tone: 'zinc' }
] as const;

export type NotificationUnreadCounts = Record<NotificationTabId, number>;

export const EMPTY_NOTIFICATION_UNREAD_COUNTS: NotificationUnreadCounts = {
	messages: 0,
	'comment-mention': 0,
	'like-collect': 0,
	'new-follow': 0,
	system: 0
};

/** 0 隐藏；1–99 显示数字；超过 99 显示 99+ */
export function formatNotificationBadgeCount(count: number): string | null {
	if (!Number.isFinite(count) || count <= 0) return null;
	if (count > 99) return '99+';
	return String(Math.floor(count));
}
