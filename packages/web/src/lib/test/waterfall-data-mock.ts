import type { WaterfallData } from '$lib/components/custom/waterfall/waterfall-container/types';
import type { V1PostPreview } from '$lib/api/types.gen';
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
