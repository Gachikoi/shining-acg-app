/**
 * TEMP MOCK: 人测/联调占位，对接真实个人资料 API 后删除。
 * 关联 QA: .specs/profile/mine-profile/qa/profile.header.md
 * 及 profile.header.* / profile.content.* 下同目录 QA。
 *
 * 头像 / 封面 URL 与首页瀑布流 mock 同源：Dicebear + Picsum
 * （见 `$lib/test/waterfall-data-mock.ts`）。
 */

import type { ProfileOwner, ProfilePostCard, ProfileContentTabId } from './types';

const OWNER_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=hezhihang';

const AUTHORS = [
	{ name: '摄影师小王', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1' },
	{ name: '旅行达人', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2' },
	{ name: '美食家', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3' },
	{ name: '艺术家', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=4' },
	{ name: '科技博主', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5' }
] as const;

const TITLES = [
	'春日樱花盛开',
	'夏日海滩日落',
	'秋日红叶满山',
	'冬日雪景如画',
	'城市夜景',
	'乡村田园',
	'山川河流',
	'森林探险',
	'美食分享',
	'旅行日记',
	'宠物日常',
	'艺术创作'
] as const;

/** 与首页瀑布流相近的竖图比例高度 */
const COVER_HEIGHTS = [300, 400, 500, 600, 350, 450] as const;

export const MOCK_PROFILE_OWNER: ProfileOwner = {
	id: 'user-hezhihang',
	displayName: '贺知章',
	avatarUrl: OWNER_AVATAR,
	verifiedTitle: '社刊 vol.9 编辑',
	tags: ['WOTA 艺组', 'WOTA 艺组', 'WOTA 艺组', 'WOTA 艺组'],
	qq: '1131997238',
	followingCount: 99,
	followersCount: 99,
	likesCollectCount: 99,
	socialLinks: [
		{ id: 'bilibili', label: '哔哩哔哩' },
		{ id: 'github', label: 'Github' },
		{ id: 'xiaohongshu', label: '小红书' }
	]
};

function sampleCard(id: string, index: number): ProfilePostCard {
	const author = AUTHORS[index % AUTHORS.length];
	const title = TITLES[index % TITLES.length];
	const height = COVER_HEIGHTS[index % COVER_HEIGHTS.length];
	const seed = `${id}-${index}`;

	return {
		id,
		title,
		coverUrl: `https://picsum.photos/400/${height}?random=${encodeURIComponent(seed)}`,
		authorName: author.name,
		authorAvatarUrl: author.avatar,
		likeCount: 80 + index * 17,
		liked: index % 3 === 0
	};
}

function cardsForTab(prefix: string, count: number): ProfilePostCard[] {
	return Array.from({ length: count }, (_, i) => sampleCard(`${prefix}-${i + 1}`, i));
}

export const MOCK_POSTS_BY_TAB: Record<ProfileContentTabId, ProfilePostCard[]> = {
	posts: cardsForTab('post', 4),
	favorites: cardsForTab('fav', 4),
	likes: cardsForTab('like', 4)
};
