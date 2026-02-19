import type {
	V1Post as Post,
	V1Media as Media,
	V1UserSummary as UserSummary,
	V1GetPostResponse as GetPostResponse,
	V1Comment,
	V1CommentWithFirstReply,
	V1CommentStats,
	V1CommentRelationStatus,
	V1ListPostCommentsResponse
} from '$lib/api';

/** 开发/联调时无后端可用，用此 mock 数据测试帖子详情 UI 与接口结构 */

const now = Math.floor(Date.now() / 1000);
const twoHoursAgo = String(now - 7200);
const fiveMinAgo = String(now - 300);
const oneMinAgo = String(now - 60);

export type PostDetailMockScenario =
	| 'default'
	| 'no-media'
	| 'single-image'
	| 'multi-image'
	| 'video-only'
	| 'short-text'
	| 'long-text'
	| 'no-title'
	| 'no-avatar'
	| 'stats-zero'
	| 'comments-empty'
	| 'comments-few'
	| 'comments-many'
	| 'comments-long'
	| 'comments-liked-by-me';

function makeAuthor(partial?: Partial<UserSummary>): UserSummary {
	return {
		user_id: partial?.user_id ?? 'mock-user-1',
		name: partial?.name ?? '晒你测试用户',
		avatar: partial?.avatar ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=test',
		departments: partial?.departments ?? [
			{ id: '1', name: '轻音部' },
			{ id: '2', name: '23 届' }
		],
		verified_title: partial?.verified_title ?? '23 届部长'
	};
}

function makeImageMedia(
	id: string,
	object_key: string,
	width: number,
	height: number,
	mime_type: string
): Media {
	return {
		id,
		type: 'MEDIA_TYPE_IMAGE',
		object_key,
		meta: { width, height, mime_type },
		status: 1
	};
}

function makeVideoMedia(
	id: string,
	object_key: string,
	width: number,
	height: number,
	mime_type: string
): Media {
	return {
		id,
		type: 'MEDIA_TYPE_VIDEO',
		object_key,
		meta: { width, height, mime_type },
		status: 1
	};
}

function makeMediaList(scenario: PostDetailMockScenario): Media[] {
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
		makeVideoMedia('m3', 'https://www.w3schools.com/html/mov_bbb.mp4', 1080, 1350, 'video/mp4')
	];

	switch (scenario) {
		case 'no-media':
			return [];
		case 'single-image':
			return [multi[0]!];
		case 'multi-image':
			return [multi[0]!, multi[1]!];
		case 'video-only':
			return [multi[2]!];
		default:
			return multi;
	}
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
 * 字段设计与 proto `api.community.v1.Post` / 类型 `Post` 保持一致。
 */
export function getMockPost(postId: string, scenario: PostDetailMockScenario = 'default'): Post {
	const author = scenario === 'no-avatar' ? makeAuthor({ avatar: '' }) : makeAuthor();

	const title = scenario === 'no-title' ? '' : '【Mock】帖子详情 UI 测试数据';
	const content =
		scenario === 'short-text'
			? '短正文：用于测试无折叠时的排版与留白。'
			: scenario === 'long-text'
				? longContent
				: longContent;

	const media = makeMediaList(scenario);

	const statsZero = scenario === 'stats-zero';
	const commentCount =
		scenario === 'comments-empty'
			? '0'
			: scenario === 'comments-many'
				? '35'
				: scenario === 'comments-few'
					? '3'
					: scenario === 'comments-long'
						? '8'
						: '6';

	return {
		post_id: postId,
		author,
		title,
		content,
		media,
		stats: {
			like_count: statsZero ? '0' : '128',
			comment_count: commentCount,
			collect_count: statsZero ? '0' : '32',
			view_count: statsZero ? '0' : '1024'
		},
		relation_status: {
			is_liked: scenario === 'comments-liked-by-me' ? true : false,
			is_collected: false
		},
		publish_time: twoHoursAgo,
		update_time: twoHoursAgo
	};
}

/**
 * 按照接口 `GetPostResponse` 的结构返回帖子详情 mock。
 * 对应后端 rpc: ContentService.GetPost / GET /v1/posts/{post_id}
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
		'为了覆盖“超长评论内容折行/溢出/查看更多”等排版场景，这里会生成一段更长的文本。'.repeat(12)
	);
}

export function getMockPostComments(
	postId: string,
	scenario: PostDetailMockScenario = 'default'
): V1CommentWithFirstReply[] {
	if (scenario === 'comments-empty') return [];

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
		reply_count: 1,
		is_liked: scenario === 'comments-liked-by-me'
	});

	const replyToTop1 = makeCommentBase({
		comment_id: 'c2',
		post_id: postId,
		author: authorB,
		content: 'mock 评论 2：回复楼上。',
		create_time: oneMinAgo,
		like_count: 2,
		reply_count: 0,
		reply_context: {
			parent_comment_id: 'c1',
			reply_to_comment_id: 'c1',
			reply_to_user_id: authorA.user_id,
			reply_to_user_name: authorA.name
		}
	});

	const top2 = makeCommentBase({
		comment_id: 'c3',
		post_id: postId,
		author: authorC,
		content:
			scenario === 'comments-long'
				? makeLongCommentText('c3')
				: 'mock 评论 3：用于测试评论列表与回复占位 UI。',
		create_time: fiveMinAgo,
		like_count: 0,
		reply_count: 0
	});

	const base: V1CommentWithFirstReply[] = [
		{ comment: top1, first_reply: replyToTop1, first_reply_cursor: '' },
		{ comment: top2, first_reply: undefined, first_reply_cursor: '' }
	];

	if (
		scenario === 'comments-few' ||
		scenario === 'default' ||
		scenario === 'comments-long' ||
		scenario === 'comments-liked-by-me'
	) {
		return base;
	}

	// comments-many：生成更多一级评论，覆盖分页/滚动/性能场景
	const many: V1CommentWithFirstReply[] = [...base];
	for (let i = 4; i <= 28; i += 1) {
		const idx = String(i);
		const author = makeAuthor({ user_id: `u${100 + i}`, name: `用户 ${idx}`, avatar: '' });
		const content =
			i % 5 === 0
				? makeLongCommentText(`c${idx}`)
				: `mock 评论 c${idx}：用于测试列表滚动与分隔线显示。`;

		many.push({
			comment: makeCommentBase({
				comment_id: `c${idx}`,
				post_id: postId,
				author,
				content,
				create_time: String(now - 60 * i),
				like_count: i % 7 === 0 ? 12 : i % 3,
				reply_count: i % 4 === 0 ? 2 : 0,
				is_liked: scenario === 'comments-liked-by-me' && i % 6 === 0
			}),
			first_reply: undefined,
			first_reply_cursor: ''
		});
	}
	return many;
}

export function getMockListPostCommentsResponse(
	postId: string,
	scenario: PostDetailMockScenario = 'default'
): V1ListPostCommentsResponse {
	return {
		comments: getMockPostComments(postId, scenario),
		cursor: '' // 空串代表无下一页
	};
}
