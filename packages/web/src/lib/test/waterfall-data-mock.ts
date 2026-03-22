import type { V1PostPreview, V1UserSummary, FeedServiceGetFeedData } from '$lib/api/types.gen';

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
	'运动健身',
	'音乐现场',
	'艺术创作',
	'科技前沿'
];

const AUTHORS = [
	{ userId: '1', name: '摄影师小王', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1' },
	{ userId: '2', name: '旅行达人', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2' },
	{ userId: '3', name: '美食家', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3' },
	{ userId: '4', name: '艺术家', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=4' },
	{ userId: '5', name: '科技博主', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5' }
];

const ASPECT_RATIOS = [
	{ width: 400, height: 300 },
	{ width: 400, height: 400 },
	{ width: 400, height: 500 },
	{ width: 400, height: 600 },
	{ width: 400, height: 350 },
	{ width: 400, height: 450 }
];

function generatePost(id: string): V1PostPreview {
	const author = AUTHORS[Math.floor(Math.random() * AUTHORS.length)];
	const aspectRatio = ASPECT_RATIOS[Math.floor(Math.random() * ASPECT_RATIOS.length)];
	const title = TITLES[Math.floor(Math.random() * TITLES.length)];
	const likeCount = Math.floor(Math.random() * 10000);
	const viewCount = Math.floor(Math.random() * 50000);
	const commentCount = Math.floor(Math.random() * 500);
	const isLiked = Math.random() > 0.7;
	const isOnlyVideo = Math.random() > 0.8;
	const publishTime = Math.floor(Date.now() / 1000 - Math.random() * 86400 * 30).toString();

	return {
		postId: `post_${id}`,
		displayTitle: `${title} #${id}`,
		cover: {
			assetId: `asset_cover_${id}`,
			type: isOnlyVideo ? 'MEDIA_TYPE_VIDEO' : 'MEDIA_TYPE_IMAGE',
			scene: 'MEDIA_SCENE_POST_COVER',
			status: 'MEDIA_STATUS_UNSPECIFIED',
			orderIndex: 0,
			single: {
				fileId: `file_${id}`,
				status: 'MEDIA_STATUS_COMPLETED',
				type: isOnlyVideo ? 'MEDIA_TYPE_VIDEO' : 'MEDIA_TYPE_IMAGE',
				bucket: 'test-bucket',
				objectKey: `test/image_${id}.jpg`,
				url: `https://picsum.photos/400/${aspectRatio.height}?random=${id}`,
				meta: {
					width: aspectRatio.width,
					height: aspectRatio.height,
					durationMs: '0',
					sizeBytes: '0',
					mimeType: 'image/jpeg'
				}
			}
		},
		author: {
			userId: author.userId,
			name: author.name,
			avatar: author.avatar,
			qqNumber: '1234567890',
			role: 'ROLE_USER'
		},
		stats: {
			likeCount: likeCount.toString(),
			viewCount: viewCount.toString(),
			commentCount: commentCount.toString(),
			collectCount: Math.floor(likeCount * 0.3).toString()
		},
		relationStatus: {
			isLiked,
			isCollected: Math.random() > 0.8
		},
		isOnlyVideo,
		publishTime,
		updateTime: publishTime
	};
}

export function generatePosts(count: number): V1PostPreview[] {
	const posts: V1PostPreview[] = [];
	for (let i = 0; i < count; i++) {
		posts.push(generatePost(crypto.randomUUID()));
	}
	return posts;
}

/** @deprecated 已被 FeedStore 替代，保留仅供旧测试代码参考 */
export const data = { posts: generatePosts(50) };

// ─── 用户 Mock 数据 ───────────────────────────────────────────────

const USER_NAMES = [
	'康熙',
	'旅行达人',
	'美食家小李',
	'艺术家阿花',
	'科技博主',
	'设计师小张',
	'音乐人老赵',
	'健身教练',
	'读书笔记',
	'动漫爱好者'
] as const;

const DEPARTMENTS = [
	{ id: 'wota', name: 'WOTA 艺组' },
	{ id: 'video', name: '视频组' },
	{ id: 'cos', name: 'COS 部' },
	{ id: 'music', name: '轻音部' },
	{ id: 'dance', name: '舞蹈部' },
	{ id: 'art', name: '美术组' },
	{ id: 'tech', name: '技术部' }
] as const;

const VERIFIED_TITLES = ['社刊 vol.9 编辑', '23届部长', '24届副部长', '社团创始人'] as const;

/**
 * 生成单个用户摘要 mock 数据
 *
 * @param id - 用户序号
 * @returns V1UserSummary mock 数据
 */
function generateUser(id: string): V1UserSummary {
	const name = USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)];
	const followerCount = Math.floor(Math.random() * 5000);
	const likeReceived = Math.floor(Math.random() * 100000000);
	const collectReceived = Math.floor(Math.random() * 10000000);

	// 随机分配 2~5 个部门
	const deptCount = 2 + Math.floor(Math.random() * 4);
	const shuffled = [...DEPARTMENTS].sort(() => Math.random() - 0.5);
	const departments = shuffled.slice(0, deptCount);

	return {
		userId: `user_${id}`,
		name: `${name}`,
		avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
		qqNumber: `${1100000000 + Math.floor(Math.random() * 90000000)}`,
		role: Math.random() > 0.8 ? 'ROLE_ADMIN' : 'ROLE_USER',
		verifiedTitle: VERIFIED_TITLES[Math.floor(Math.random() * VERIFIED_TITLES.length)],
		departments,
		stats: {
			followerCount: followerCount.toString(),
			followingCount: Math.floor(Math.random() * 500).toString(),
			likeCountReceived: likeReceived.toString(),
			collectCountReceived: collectReceived.toString(),
			viewCountReceived: Math.floor(Math.random() * 1000000).toString()
		}
	};
}

/**
 * 批量生成用户摘要 mock 数据（用于骨架屏占位）
 *
 * @param count - 生成数量
 * @param startIndex - 起始序号
 * @returns V1UserSummary[] mock 数据列表
 */
export function generateUsers(count: number): V1UserSummary[] {
	const users: V1UserSummary[] = [];
	for (let i = 0; i < count; i++) {
		users.push(generateUser(crypto.randomUUID()));
	}
	return users;
}

/**
 * 模拟 API 请求
 */
export async function mockFetchFeed(
	params: FeedServiceGetFeedData
): Promise<{ data: { posts: { items: V1PostPreview[] }; cursor: string } }> {
	await new Promise((resolve) => setTimeout(resolve, 800));
	const query = params.query || {};

	const currentOffset = query['pagination.cursor'] ? parseInt(query['pagination.cursor']) : 0;
	const limit = query['pagination.needNum'] || 20;

	let candidates = generatePosts(100);
	const scene = query.categoryId || '';

	if (scene === 'following') {
		candidates = candidates.filter((p) => ['1', '2'].includes(p.author?.userId || ''));
		if (query['filter.authorId']) {
			candidates = candidates.filter((p) => p.author?.userId === query['filter.authorId']);
		}
	}

	if (['self_post', 'self_like', 'self_collect'].includes(scene)) {
		candidates = candidates.filter((p) => p.author?.userId === '1');
	}

	if (query['filter.keyword']) {
		const kw = query['filter.keyword'].toLowerCase();
		if (candidates.length > 0) {
			let matchCount = 0;
			candidates.forEach((p) => {
				if (matchCount < 5) {
					p.displayTitle = `${kw} - ${p.displayTitle}`;
					matchCount++;
				}
			});
		}
		candidates = candidates.filter((p) => p.displayTitle?.toLowerCase().includes(kw));
	}

	if (query['filter.timeRange.startTimestamp']) {
		const start = parseInt(query['filter.timeRange.startTimestamp']);
		candidates = candidates.filter((p) => parseInt(p.publishTime || '0') >= start);
	}
	if (query['filter.timeRange.endTimestamp']) {
		const end = parseInt(query['filter.timeRange.endTimestamp']);
		candidates = candidates.filter((p) => parseInt(p.publishTime || '0') <= end);
	}

	if (query['filter.orderType'] === 'FEED_ORDER_TYPE_HOT') {
		candidates.sort((a, b) => {
			const likeA = parseInt(a.stats?.likeCount || '0');
			const likeB = parseInt(b.stats?.likeCount || '0');
			return likeB - likeA;
		});
	} else if (query['filter.orderType'] === 'FEED_ORDER_TYPE_LATEST') {
		candidates.sort((a, b) => {
			const timeA = parseInt(a.publishTime || '0');
			const timeB = parseInt(b.publishTime || '0');
			return timeB - timeA;
		});
	}

	const resultItems = candidates.slice(0, limit);
	const nextCursor = (currentOffset + limit).toString();

	return {
		data: {
			posts: {
				items: resultItems
			},
			cursor: nextCursor
		}
	};
}
