import type { WaterfallData } from '$lib/components/custom/waterfall/waterfall-container/types';
import type { V1PostPreview } from '$lib/api/types.gen';

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
			type: 'image',
			scene: 'post_cover',
			status: 'ready',
			single: {
				id: `file_${id}`,
				type: 'image',
				bucket: 'test-bucket',
				object_key: `test/image_${id}.jpg`,
				url: `https://picsum.photos/400/${aspectRatio.height}?random=${id}`,
				meta: {
					width: aspectRatio.width,
					height: aspectRatio.height,
					size: Math.floor(Math.random() * 5000000),
					mime_type: 'image/jpeg',
					format: 'jpeg'
				}
			}
		},
		author: {
			user_id: author.user_id,
			name: author.name,
			avatar: author.avatar
		},
		stats: {
			like_count: likeCount,
			view_count: viewCount,
			comment_count: commentCount,
			collect_count: Math.floor(likeCount * 0.3),
			share_count: Math.floor(likeCount * 0.1)
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
	let posts: V1PostPreview[] = generatePosts(50, 0);
	let cursor = '50';
	let loading = false;
	let refreshing = false;
	let hasMore = true;

	return {
		get posts() {
			return posts;
		},
		get loading() {
			return loading;
		},
		get refreshing() {
			return refreshing;
		},
		get hasMore() {
			return hasMore;
		},
		get cursor() {
			return cursor;
		},
		loadMore: async () => {
			loading = true;
			await new Promise((resolve) => setTimeout(resolve, 1000));
			const newPosts = generatePosts(20, posts.length);
			posts = [...posts, ...newPosts];
			cursor = posts.length.toString();
			hasMore = posts.length < 200;
			loading = false;
		},
		refresh: async () => {
			refreshing = true;
			await new Promise((resolve) => setTimeout(resolve, 1500));
			posts = generatePosts(30, 0);
			cursor = '30';
			hasMore = true;
			refreshing = false;
		}
	};
}

export const data = createMockWaterfallData();
