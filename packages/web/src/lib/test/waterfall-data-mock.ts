import type { WaterfallData } from '$lib/components/custom/waterfall/waterfall-container/types';
import type { V1PostPreview, FeedServiceGetFeedData } from '$lib/api/types.gen';
import { writable, get } from 'svelte/store';

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
	{ user_id: '1', name: '摄影师小王', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1' },
	{ user_id: '2', name: '旅行达人', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2' },
	{ user_id: '3', name: '美食家', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3' },
	{ user_id: '4', name: '艺术家', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=4' },
	{ user_id: '5', name: '科技博主', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5' }
];

const ASPECT_RATIOS = [
	{ width: 400, height: 300 },
	{ width: 400, height: 400 },
	{ width: 400, height: 500 },
	{ width: 400, height: 600 },
	{ width: 400, height: 350 },
	{ width: 400, height: 450 }
];

function generatePost(id: number): V1PostPreview {
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
		post_id: `post_${id}`,
		display_title: `${title} #${id}`,
		cover: {
			item_id: `cover_${id}`,
			type: isOnlyVideo ? 'MEDIA_TYPE_VIDEO' : 'MEDIA_TYPE_IMAGE',
			status: 'MEDIA_STATUS_UNSPECIFIED',
			single: {
				id: `file_${id}`,
				type: isOnlyVideo ? 'MEDIA_TYPE_VIDEO' : 'MEDIA_TYPE_IMAGE',
				bucket: 'test-bucket',
				object_key: `test/image_${id}.jpg`,
				url: `https://picsum.photos/400/${aspectRatio.height}?random=${id}`,
				meta: {
					width: aspectRatio.width,
					height: aspectRatio.height,
					mime_type: 'image/jpeg'
				}
			}
		},
		author: {
			user_id: author.user_id,
			name: author.name,
			avatar: author.avatar
		},
		stats: {
			like_count: likeCount.toString(),
			view_count: viewCount.toString(),
			comment_count: commentCount.toString(),
			collect_count: Math.floor(likeCount * 0.3).toString()
		},
		relation_status: {
			is_liked: isLiked,
			is_collected: Math.random() > 0.8
		},
		is_only_video: isOnlyVideo,
		publish_time: publishTime,
		update_time: publishTime
	};
}

function generatePosts(count: number, startIndex: number): V1PostPreview[] {
	const posts: V1PostPreview[] = [];
	for (let i = 0; i < count; i++) {
		posts.push(generatePost(startIndex + i));
	}
	return posts;
}

export function createMockWaterfallData(): WaterfallData {
	const posts = writable<V1PostPreview[]>(generatePosts(50, 0));
	const cursor = writable('50');
	const loading = writable(false);
	const refreshing = writable(false);
	const hasMore = writable(true);

	return {
		posts,
		loading,
		refreshing,
		hasMore,
		cursor,
		loadMore: async () => {
			loading.set(true);
			await new Promise((resolve) => setTimeout(resolve, 1000));
			posts.update((current) => {
				const newPosts = generatePosts(20, current.length);
				return [...current, ...newPosts];
			});
			cursor.set(get(posts).length.toString());
			hasMore.set(get(posts).length < 200);
			loading.set(false);
		},
		refresh: async () => {
			refreshing.set(true);
			await new Promise((resolve) => setTimeout(resolve, 1500));
			posts.set(generatePosts(30, 0));
			cursor.set('30');
			hasMore.set(true);
			refreshing.set(false);
		}
	};
}

export const data = createMockWaterfallData();

/**
 * 模拟 API 请求
 */
export async function mockFetchFeed(
	params: FeedServiceGetFeedData
): Promise<{ data: { posts: { items: V1PostPreview[] }; cursor: string } }> {
	// 模拟网络延迟
	await new Promise((resolve) => setTimeout(resolve, 800));
	const query = params.query || {};

	// 根据 params 生成数据
	// 1. 获取当前 cursor (模拟分页)
	const currentOffset = query['pagination.cursor'] ? parseInt(query['pagination.cursor']) : 0;
	// 稍微多生成一点以便过滤
	const limit = query['pagination.need_num'] || 20;

	// 2. 生成原始数据 (这里我们简单地基于 offset 生成，保证每次生成的 ID 不同)
	// 在真实的场景中，瀑布流数据是动态的。
	// 为了模拟筛选效果，我们生成较多数据然后进行客户端过滤（在 mock 函数内部）
	let candidates = generatePosts(100, currentOffset);

	// 模拟场景逻辑
	const scene = query['category_id'] || '';

	// 模拟 "关注" 场景 (mock logic)
	if (scene === 'following') {
		// 假设关注了 ID 为 '1' 和 '2' 的用户
		// 过滤出这两个作者的帖子
		candidates = candidates.filter((p) => ['1', '2'].includes(p.author?.user_id || ''));

		// 如果有 specific author_id filter
		if (query['filter.author_id']) {
			candidates = candidates.filter((p) => p.author?.user_id === query['filter.author_id']);
		}
	}

	// 模拟 "个人" 场景
	if (['self_post', 'self_like', 'self_collect'].includes(scene)) {
		// 假设当前用户是 user_id '1' (mock)
		// 简单模拟: 假设所有 author.user_id='1' 的帖子是 self_post
		// 对于 like/collect 无法直接从 generatePosts 模拟，这里不做深究，仅返回 id=1 的帖子
		// 在真实 API 中，后端会根据 token 判断 "self"
		candidates = candidates.filter((p) => p.author?.user_id === '1');
	}

	// 3. 模拟筛选 (Keyword)
	if (query['filter.keyword']) {
		const kw = query['filter.keyword'].toLowerCase();
		// 在 Mock 数据中，title 是随机的。
		// 为了演示搜索效果，如果关键词匹配不到，我们就强制修改一些数据的 title
		// 仅对前几个数据修改，确保能搜到东西
		if (candidates.length > 0) {
			let matchCount = 0;
			candidates.forEach((p) => {
				if (matchCount < 5) {
					p.display_title = `${kw} - ${p.display_title}`;
					matchCount++;
				}
			});
		}

		candidates = candidates.filter((p) => p.display_title?.toLowerCase().includes(kw));
	}

	// 4. 模拟时间筛选
	if (query['filter.time_range.start_timestamp']) {
		const start = parseInt(query['filter.time_range.start_timestamp']);
		candidates = candidates.filter((p) => parseInt(p.publish_time || '0') >= start);
	}
	if (query['filter.time_range.end_timestamp']) {
		const end = parseInt(query['filter.time_range.end_timestamp']);
		candidates = candidates.filter((p) => parseInt(p.publish_time || '0') <= end);
	}

	// 5. 模拟排序 (OrderType)
	// Mock 数据本身是随机的，这里难以体现真实排序，但我们可以根据 OrderType 修改一些字段来体现
	if (query['filter.order_type'] === 'FEED_ORDER_TYPE_HOT') {
		candidates.sort((a, b) => {
			const likeA = parseInt(a.stats?.like_count || '0');
			const likeB = parseInt(b.stats?.like_count || '0');
			return likeB - likeA;
		});
	} else if (query['filter.order_type'] === 'FEED_ORDER_TYPE_LATEST') {
		candidates.sort((a, b) => {
			const timeA = parseInt(a.publish_time || '0');
			const timeB = parseInt(b.publish_time || '0');
			return timeB - timeA;
		});
	}

	// 6. 分页切片
	const resultItems = candidates.slice(0, limit);
	// 简单模拟 cursor：如果是最新排序，cursor 应该是时间戳，但为了 mock 方便，一直使用 offset
	// 只要保证前端传回来的 cursor 能解析回 offset 即可
	const nextCursor = (currentOffset + limit).toString(); // Mock: 总是推进 offset，防止 filter 导致 cursor 不动

	return {
		data: {
			posts: {
				items: resultItems
			},
			cursor: nextCursor
		}
	};
}
