/**
 * 用户列表基础组件用到的展示数据类型（与 API 解耦，由调用方从 V1UserListItem 等映射）
 */
export interface UserListItemDisplay {
	/** 用户 ID，用于跳转个人资料与关注操作 */
	userId?: string;
	/** 展示名称（优先备注，无则昵称） */
	displayName: string;
	/** 头像 URL */
	avatar?: string;
	/** QQ 号 */
	qqNumber?: string;
	/** 粉丝数（后端有则展示） */
	followerCount?: string;
	/** 获赞与收藏数（后端有则展示，可为合并展示的文案） */
	likeCollectCount?: string;
	/** 认证头衔（如：23 届部长） */
	verifiedTitle?: string;
	/** 部门名称列表，用于徽章横向滚动 */
	departmentNames?: string[];
	/** 当前用户是否关注了该用户 */
	isFollowing?: boolean;
	/** 该用户是否关注了当前用户 */
	isFollowedBy?: boolean;
}

/** UserListItem 组件 props */
export interface UserListItemProps extends UserListItemDisplay {
	/** 是否显示关注按钮，默认 true */
	showFollowButton?: boolean;
	/** 是否显示粉丝数、获赞与收藏数等统计，默认 true */
	showStats?: boolean;
	/** 是否显示认证与部门徽章，默认 true */
	showBadges?: boolean;
	/** 点击整行时的回调（如跳转个人资料），若未传则不响应整行点击 */
	onItemClick?: (userId: string) => void;
	/** 点击关注按钮时的回调（如关注/取关），若未传则关注按钮不触发操作 */
	onFollowClick?: (userId: string, follow: boolean) => void;
	/** 关注按钮是否处于加载状态（防止重复点击） */
	followLoading?: boolean;
}

/** UserListSkeleton 组件 props */
export interface UserListSkeletonProps {
	/** 骨架项数量，默认 10 */
	count?: number;
}
