import type {
	V1Post as Post,
	V1MediaAsset as Media,
	V1UserSummary as UserSummary,
	V1GetPostResponse as GetPostResponse,
	V1Comment,
	V1CommentWithReplies,
	V1CommentStats,
	V1CommentRelationStatus,
	V1ListPostCommentsResponse
} from '$lib/api';
import type { PostServiceGetPostData } from '$lib/api/types.gen';

/**
 * 开发/联调时无后端可用，用此 mock 数据测试帖子详情 UI 与接口结构。
 * - 提供纯函数生成帖子与评论 mock
 * - 提供组合后的 `createMockPostDetailData`，用于一键创建「帖子 + 评论」数据
 */

const now = Math.floor(Date.now() / 1000);
const twoHoursAgo = String(now - 7200);
const fiveMinAgo = String(now - 300);
const oneMinAgo = String(now - 60);

/**
 * 默认用于首页联调的 mock 帖子 ID。
 * 瀑布流在 mock 场景下点击任意卡片都使用这个 ID 来渲染相同的帖子详情。
 */
export const DEFAULT_POST_DETAIL_MOCK_ID = 'mock-post-1';

function makeAuthor(partial?: Partial<UserSummary>): UserSummary {
	return {
		user_id: partial?.user_id ?? 'mock-user-1',
		name: partial?.name ?? '晒你测试用户',
		avatar: partial?.avatar ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ciallo～(∠・ω< )⌒★',
		departments: partial?.departments ?? [
			{ id: '1', name: '轻音部' },
			{ id: '2', name: '23 届' }
		],
		verified_title: partial?.verified_title ?? '23 届部长'
	};
}

function pickUserIdentity(user: UserSummary): { userId: string; userName: string } {
	return {
		userId: user.user_id ?? '',
		userName: user.name ?? ''
	};
}

function makeImageMedia(
	id: string,
	url: string,
	width: number,
	height: number,
	mime_type: string
): Media {
	return {
		asset_id: id,
		type: 'MEDIA_TYPE_IMAGE',
		scene: 'MEDIA_SCENE_POST_MEDIA',
		status: 'MEDIA_STATUS_COMPLETED',
		single: {
			file_id: id,
			type: 'MEDIA_TYPE_IMAGE',
			object_key: url,
			url,
			meta: { width, height, mime_type },
			status: 'MEDIA_STATUS_COMPLETED'
		}
	};
}

function makeVideoMedia(
	id: string,
	url: string,
	width: number,
	height: number,
	mime_type: string
): Media {
	return {
		asset_id: id,
		type: 'MEDIA_TYPE_VIDEO',
		scene: 'MEDIA_SCENE_POST_MEDIA',
		status: 'MEDIA_STATUS_COMPLETED',
		single: {
			file_id: id,
			type: 'MEDIA_TYPE_VIDEO',
			object_key: url,
			url,
			meta: { width, height, mime_type },
			status: 'MEDIA_STATUS_COMPLETED'
		}
	};
}

function makeMediaList(): Media[] {
	const multi: Media[] = [
		makeImageMedia(
			'm1',
			'https://fastly.picsum.photos/id/581/1080/1350.jpg?hmac=cd2_S4wHGI58ibJA_C3J2XZHhN0MLKiiJqAfWuz-_dQ',
			1080,
			1350,
			'image/jpeg'
		),
		makeImageMedia(
			'm2',
			'https://fastly.picsum.photos/id/522/800/600.jpg?hmac=yfhp98TsiK5ithmulNqY0wgo9UhYxPYDjvm3j89Ev0c',
			800,
			600,
			'image/webp'
		),
		makeVideoMedia('m3', 'https://www.w3schools.com/html/mov_bbb.mp4', 1080, 1350, 'video/mp4'),
		makeVideoMedia('m4', 'https://www.w3schools.com/html/mov_bbb.mp4', 1080, 1350, 'video/mp4')
	];
	return multi;
}

/** 用于测试「查看全文」的长正文（超过 1k 字） */
const longContent =
	'这是一条用于测试帖子详情 UI 的 mock 正文。\n\n' +
	'你可以检查：\n' +
	'- 左侧/上方媒体区与多图切换、页码\n' +
	'- 右侧/下方作者信息、部门徽章横向滚动、认证标识\n' +
	'- 标题、时间（即时性优先）、正文与「查看全文/收起内容」\n' +
	'- 评论区最热/最新排序、评论列表、回复占位\n' +
	'- 底部点赞、评论、收藏、分享\n\n' +
	'这里再补一段文字以超过 1000 字，触发折叠。'.repeat(60);

/**
 * 仅返回帖子实体，方便直接注入到组件中使用。
 */
export function getMockPost(postId: string): Post {
	const author = makeAuthor();
	const title = '【Mock】帖子详情 UI 测试数据';
	const content = longContent;
	const media = makeMediaList();

	return {
		post_id: postId,
		author,
		title,
		content,
		media,
		stats: {
			like_count: '128',
			comment_count: '35',
			collect_count: '32',
			view_count: '1024'
		},
		relation_status: {
			is_liked: false,
			is_collected: false
		},
		publish_time: twoHoursAgo,
		update_time: twoHoursAgo
	};
}

/**
 * 按照接口 `GetPostResponse` 的结构返回帖子详情 mock。
 */
export function getMockGetPostResponse(postId: string): GetPostResponse {
	return {
		post: getMockPost(postId)
	};
}

function makeCommentStats(like: number, reply: number): V1CommentStats {
	return { like_count: String(like), reply_count: String(reply) };
}

function makeCommentRelation(isLiked: boolean): V1CommentRelationStatus {
	return { is_liked: isLiked };
}

function makeCommentBase(args: {
	comment_id: string;
	post_id: string;
	author: UserSummary;
	content: string;
	create_time: string;
	like_count: number;
	reply_count: number;
	is_liked?: boolean;
	reply_context?: V1Comment['reply_context'];
}): V1Comment {
	return {
		comment_id: args.comment_id,
		target_id: args.post_id,
		author: args.author,
		content: args.content,
		create_time: args.create_time,
		stats: makeCommentStats(args.like_count, args.reply_count),
		relation_status: makeCommentRelation(args.is_liked ?? false),
		reply_context: args.reply_context
	};
}

function makeLongCommentText(seed: string): string {
	return (
		`长评论（${seed}）：` +
		'为了覆盖“超长评论内容折行/溢出/查看更多”等排版场景，这里会生成一段更长的文本。'.repeat(25)
	);
}

function makeReply(args: {
	postId: string;
	parentCommentId: string;
	replyId: string;
	author: UserSummary;
	content: string;
	createTime: string;
	replyTo: { commentId: string; userId: string; userName: string };
	likeCount?: number;
	isLiked?: boolean;
}): V1Comment {
	return makeCommentBase({
		comment_id: args.replyId,
		post_id: args.postId,
		author: args.author,
		content: args.content,
		create_time: args.createTime,
		like_count: args.likeCount ?? 0,
		reply_count: 0,
		is_liked: args.isLiked ?? false,
		reply_context: {
			parent_comment_id: args.parentCommentId,
			reply_to_comment_id: args.replyTo.commentId,
			reply_to_user_id: args.replyTo.userId,
			reply_to_user_name: args.replyTo.userName
		}
	});
}

export function getMockPostComments(postId: string): V1CommentWithReplies[] {
	// 固定只生成“comments-many”风格：多条一级评论，每条带多条回复，确保多级评论可展开/可渲染
	const authorA = makeAuthor({ user_id: 'u2', name: '路人甲', avatar: '' });
	const authorB = makeAuthor({
		user_id: 'u3',
		name: '瓶子君152',
		avatar: '',
		departments: [{ id: '1', name: '轻音部' }]
	});
	const authorC = makeAuthor({ user_id: 'u4', name: '测试用户 B', avatar: '' });

	const top1 = makeCommentBase({
		comment_id: 'c1',
		post_id: postId,
		author: authorA,
		content: 'mock 评论 1：点赞数高，会排在最热前面。',
		create_time: fiveMinAgo,
		like_count: 10,
		reply_count: 3
	});

	const repliesTop1: V1Comment[] = [
		makeReply({
			postId,
			parentCommentId: 'c1',
			replyId: 'c1-r1',
			author: authorB,
			content: '回复 1：我也这么觉得。',
			createTime: oneMinAgo,
			replyTo: { commentId: 'c1', ...pickUserIdentity(authorA) },
			likeCount: 2
		}),
		makeReply({
			postId,
			parentCommentId: 'c1',
			replyId: 'c1-r2',
			author: authorC,
			content: '回复 2：补充一些细节～',
			createTime: String(now - 40),
			replyTo: { commentId: 'c1-r1', ...pickUserIdentity(authorB) }
		}),
		makeReply({
			postId,
			parentCommentId: 'c1',
			replyId: 'c1-r3',
			author: authorA,
			content: '回复 3：谢谢大家讨论。',
			createTime: String(now - 20),
			replyTo: { commentId: 'c1-r2', ...pickUserIdentity(authorC) }
		})
	];

	const top2 = makeCommentBase({
		comment_id: 'c3',
		post_id: postId,
		author: authorC,
		content: makeLongCommentText('c3'),
		create_time: fiveMinAgo,
		like_count: 0,
		reply_count: 2
	});

	const repliesTop2: V1Comment[] = [
		makeReply({
			postId,
			parentCommentId: 'c3',
			replyId: 'c3-r1',
			author: authorB,
			content: '回复 1：长评写得很认真。',
			createTime: String(now - 90),
			replyTo: { commentId: 'c3', ...pickUserIdentity(authorC) }
		}),
		makeReply({
			postId,
			parentCommentId: 'c3',
			replyId: 'c3-r2',
			author: authorA,
			content: '回复 2：赞同，信息量很大。',
			createTime: String(now - 70),
			replyTo: { commentId: 'c3-r1', ...pickUserIdentity(authorB) }
		})
	];

	const many: V1CommentWithReplies[] = [
		{ comment: top1, replies: repliesTop1, cursor: '' },
		{ comment: top2, replies: repliesTop2, cursor: '' }
	];

	for (let i = 4; i <= 28; i += 1) {
		const idx = String(i);
		const author = makeAuthor({ user_id: `u${100 + i}`, name: `用户 ${idx}`, avatar: '' });
		const content =
			i % 5 === 0
				? makeLongCommentText(`c${idx}`)
				: `mock 评论 c${idx}：用于测试列表滚动与分隔线显示。`;

		const parentId = `c${idx}`;
		const top = makeCommentBase({
			comment_id: parentId,
			post_id: postId,
			author,
			content,
			create_time: String(now - 60 * i),
			like_count: i % 7 === 0 ? 12 : i % 3,
			reply_count: 2
		});

		const rAuthor1 = makeAuthor({ user_id: `u${200 + i}`, name: `回复者 ${idx}-A`, avatar: '' });
		const rAuthor2 = makeAuthor({ user_id: `u${300 + i}`, name: `回复者 ${idx}-B`, avatar: '' });
		const replies: V1Comment[] = [
			makeReply({
				postId,
				parentCommentId: parentId,
				replyId: `${parentId}-r1`,
				author: rAuthor1,
				content: `回复 1：围观一下（${idx}）`,
				createTime: String(now - 60 * i + 10),
				replyTo: { commentId: parentId, ...pickUserIdentity(author) }
			}),
			makeReply({
				postId,
				parentCommentId: parentId,
				replyId: `${parentId}-r2`,
				author: rAuthor2,
				content: `回复 2：同意楼上（${idx}）`,
				createTime: String(now - 60 * i + 25),
				replyTo: { commentId: `${parentId}-r1`, ...pickUserIdentity(rAuthor1) }
			})
		];

		many.push({
			comment: top,
			replies,
			cursor: ''
		});
	}

	return many;
}

export function getMockListPostCommentsResponse(postId: string): V1ListPostCommentsResponse {
	return {
		comments: getMockPostComments(postId),
		cursor: '' // 空串代表无下一页
	};
}

/**
 * 组合输出：帖子详情 + 评论列表。
 */
export function createMockPostDetailData(postId: string): {
	post: Post;
	comments: V1CommentWithReplies[];
	response: {
		post: GetPostResponse;
		comments: V1ListPostCommentsResponse;
	};
} {
	const post = getMockPost(postId);
	const comments = getMockPostComments(postId);

	return {
		post,
		comments,
		response: {
			post: getMockGetPostResponse(postId),
			comments: getMockListPostCommentsResponse(postId)
		}
	};
}

/**
 * 默认导出的 mock 数据，便于在页面中快速引用：
 * - `postDetailMockData.post`：帖子实体
 * - `postDetailMockData.comments`：评论列表（用于 CommentSection 的 initial 数据）
 */
export const postDetailMockData = createMockPostDetailData(DEFAULT_POST_DETAIL_MOCK_ID);

export type PostDetailMockBundle = {
	defaultPostId: string;
	post: Post;
	mockComments: V1CommentWithReplies[];
};

export function createPostDetailMockBundle(
	postId: string = DEFAULT_POST_DETAIL_MOCK_ID
): PostDetailMockBundle {
	const data = createMockPostDetailData(postId);
	return {
		defaultPostId: postId,
		post: data.post,
		mockComments: data.comments
	};
}

export const postDetailMockBundle = createPostDetailMockBundle(DEFAULT_POST_DETAIL_MOCK_ID);

/**
 * 模拟 API 请求：获取帖子详情
 *
 * - 仅用于单元测试/本地联调（由调用方显式选择使用）
 */
export async function mockGetPost(
	params: PostServiceGetPostData
): Promise<{ data: GetPostResponse }> {
	// 模拟网络延迟
	await new Promise((resolve) => setTimeout(resolve, 400));
	const postId = params.path?.post_id || DEFAULT_POST_DETAIL_MOCK_ID;
	return { data: getMockGetPostResponse(postId) };
}
