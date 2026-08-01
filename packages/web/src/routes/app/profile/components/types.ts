export type ProfileContentTabId = 'posts' | 'favorites' | 'likes';

export type ProfileStatId = 'following' | 'followers' | 'likesCollect';

export type ProfileActionId =
	| 'share'
	| 'editNickname'
	| 'applyIdentity'
	| 'editDeptBadge'
	| 'editSocialLinks';

export type ProfileSocialLink = {
	id: string;
	label: string;
	href?: string;
};

export type ProfileOwner = {
	id: string;
	displayName: string;
	avatarUrl?: string;
	verifiedTitle?: string;
	tags: string[];
	qq?: string;
	followingCount: number;
	followersCount: number;
	likesCollectCount: number;
	socialLinks: ProfileSocialLink[];
};

export type ProfilePostCard = {
	id: string;
	title: string;
	coverUrl?: string;
	authorName: string;
	authorAvatarUrl?: string;
	likeCount: number;
	liked?: boolean;
};
