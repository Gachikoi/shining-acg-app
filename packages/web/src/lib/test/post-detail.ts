import type {
	V1Post as Post,
	V1MediaAsset as Media,
	V1UserSummary as UserSummary,
	V1UserBrief,
	V1Comment,
	V1CommentWithReplies,
	V1CommentStats,
	V1CommentRelationStatus
} from '$lib/api';

/**
 * 开发/联调时无后端可用，用此 mock 数据生成帖子与评论。
 * `getMockPost` 和 `getMockPostComments` 被 `api-mock.ts` 复用。
 * 字段形状严格对齐 `$lib/api`（types.gen.ts）。
 */

const nowMs = Date.now();
const twoHoursAgoMs = String(nowMs - 7200 * 1000);
const fiveMinAgoMs = String(nowMs - 300 * 1000);
const oneMinAgoMs = String(nowMs - 60 * 1000);

/**
 * 默认用于首页联调的 mock 帖子 ID。
 * 瀑布流在 mock 场景下点击任意卡片都使用这个 ID 来渲染相同的帖子详情。
 */
export const DEFAULT_POST_DETAIL_MOCK_ID = 'mock-post-1';

const defaultUserStats: UserSummary['stats'] = {
	followerCount: '128',
	followingCount: '64',
	likeCountReceived: '256',
	collectCountReceived: '32',
	viewCountReceived: '1024'
};

function makeAuthor(partial?: Partial<UserSummary>): UserSummary {
	return {
		userId: partial?.userId ?? 'mock-user-1',
		name: partial?.name ?? '晒你测试用户',
		remark: partial?.remark,
		avatar: partial?.avatar ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ciallo～(∠・ω< )⌒★',
		qqNumber: partial?.qqNumber ?? '',
		role: partial?.role ?? 'ROLE_USER',
		verifiedTitle: partial?.verifiedTitle ?? '23 届部长',
		departments: partial?.departments ?? [
			{ id: '1', name: '轻音部' },
			{ id: '2', name: '23 届' }
		],
		stats: partial?.stats ?? defaultUserStats
	};
}

function toUserBrief(user: UserSummary): V1UserBrief {
	return {
		userId: user.userId,
		name: user.name,
		remark: user.remark,
		avatar: user.avatar,
		qqNumber: user.qqNumber,
		role: user.role
	};
}

function pickUserIdentity(user: UserSummary): { userId: string; userName: string } {
	return {
		userId: user.userId,
		userName: user.name
	};
}

function makeImageMedia(
	id: string,
	url: string,
	width: number,
	height: number,
	mimeType: string,
	orderIndex: number
): Media {
	return {
		assetId: id,
		type: 'MEDIA_TYPE_IMAGE',
		scene: 'MEDIA_SCENE_POST_MEDIA',
		status: 'MEDIA_STATUS_COMPLETED',
		orderIndex,
		single: {
			fileId: id,
			type: 'MEDIA_TYPE_IMAGE',
			bucket: 'mock',
			objectKey: url,
			url,
			meta: {
				width,
				height,
				durationMs: '0',
				sizeBytes: '0',
				mimeType
			},
			status: 'MEDIA_STATUS_COMPLETED'
		}
	};
}

function makeVideoMedia(
	id: string,
	url: string,
	width: number,
	height: number,
	mimeType: string,
	orderIndex: number
): Media {
	return {
		assetId: id,
		type: 'MEDIA_TYPE_VIDEO',
		scene: 'MEDIA_SCENE_POST_MEDIA',
		status: 'MEDIA_STATUS_COMPLETED',
		orderIndex,
		single: {
			fileId: id,
			type: 'MEDIA_TYPE_VIDEO',
			bucket: 'mock',
			objectKey: url,
			url,
			meta: {
				width,
				height,
				durationMs: '0',
				sizeBytes: '0',
				mimeType
			},
			status: 'MEDIA_STATUS_COMPLETED'
		}
	};
}

function makeMediaList(): Media[] {
	return [
		makeImageMedia(
			'm1',
			'https://fastly.picsum.photos/id/581/1080/1350.jpg?hmac=cd2_S4wHGI58ibJA_C3J2XZHhN0MLKiiJqAfWuz-_dQ',
			1080,
			1350,
			'image/jpeg',
			0
		),
		makeImageMedia(
			'm2',
			'https://fastly.picsum.photos/id/522/800/600.jpg?hmac=yfhp98TsiK5ithmulNqY0wgo9UhYxPYDjvm3j89Ev0c',
			800,
			600,
			'image/webp',
			1
		),
		makeVideoMedia('m3', 'https://www.w3schools.com/html/mov_bbb.mp4', 1080, 1350, 'video/mp4', 2),
		makeVideoMedia('m4', 'https://www.w3schools.com/html/mov_bbb.mp4', 1080, 1350, 'video/mp4', 3)
	];
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
	const media = makeMediaList();

	return {
		postId,
		author,
		title,
		content: [{ type: 'text', content: longContent }],
		media,
		stats: {
			likeCount: '128',
			commentCount: '35',
			collectCount: '32',
			viewCount: '1024'
		},
		relationStatus: {
			isLiked: false,
			isCollected: false
		},
		publishTime: twoHoursAgoMs,
		updateTime: twoHoursAgoMs
	};
}

function makeCommentStats(like: number, reply: number): V1CommentStats {
	return { likeCount: String(like), replyCount: String(reply) };
}

function makeCommentRelation(isLiked: boolean): V1CommentRelationStatus {
	return { isLiked };
}

function makeCommentBase(args: {
	commentId: string;
	postId: string;
	author: UserSummary;
	content: string;
	createTime: string;
	likeCount: number;
	replyCount: number;
	isLiked?: boolean;
	replyContext?: V1Comment['replyContext'];
}): V1Comment {
	return {
		commentId: args.commentId,
		targetId: args.postId,
		targetType: 'COMMENT_TARGET_TYPE_POST',
		author: toUserBrief(args.author),
		content: args.content,
		media: [],
		createTime: args.createTime,
		stats: makeCommentStats(args.likeCount, args.replyCount),
		relationStatus: makeCommentRelation(args.isLiked ?? false),
		replyContext: args.replyContext
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
		commentId: args.replyId,
		postId: args.postId,
		author: args.author,
		content: args.content,
		createTime: args.createTime,
		likeCount: args.likeCount ?? 0,
		replyCount: 0,
		isLiked: args.isLiked ?? false,
		replyContext: {
			parentCommentId: args.parentCommentId,
			replyToCommentId: args.replyTo.commentId,
			replyToUserId: args.replyTo.userId,
			replyToUserName: args.replyTo.userName
		}
	});
}

export function getMockPostComments(postId: string): V1CommentWithReplies[] {
	const authorA = makeAuthor({ userId: 'u2', name: '路人甲', avatar: '' });
	const authorB = makeAuthor({
		userId: 'u3',
		name: '瓶子君152',
		avatar: '',
		departments: [{ id: '1', name: '轻音部' }]
	});
	const authorC = makeAuthor({ userId: 'u4', name: '测试用户 B', avatar: '' });

	const top1 = makeCommentBase({
		commentId: 'c1',
		postId,
		author: authorA,
		content: 'mock 评论 1：点赞数高，会排在最热前面。',
		createTime: fiveMinAgoMs,
		likeCount: 10,
		replyCount: 3
	});

	const repliesTop1: V1Comment[] = [
		makeReply({
			postId,
			parentCommentId: 'c1',
			replyId: 'c1-r1',
			author: authorB,
			content: '回复 1：我也这么觉得。',
			createTime: oneMinAgoMs,
			replyTo: { commentId: 'c1', ...pickUserIdentity(authorA) },
			likeCount: 2
		}),
		makeReply({
			postId,
			parentCommentId: 'c1',
			replyId: 'c1-r2',
			author: authorC,
			content: '回复 2：补充一些细节～',
			createTime: String(nowMs - 40 * 1000),
			replyTo: { commentId: 'c1-r1', ...pickUserIdentity(authorB) }
		}),
		makeReply({
			postId,
			parentCommentId: 'c1',
			replyId: 'c1-r3',
			author: authorA,
			content: '回复 3：谢谢大家讨论。',
			createTime: String(nowMs - 20 * 1000),
			replyTo: { commentId: 'c1-r2', ...pickUserIdentity(authorC) }
		})
	];

	const top2 = makeCommentBase({
		commentId: 'c3',
		postId,
		author: authorC,
		content: makeLongCommentText('c3'),
		createTime: fiveMinAgoMs,
		likeCount: 0,
		replyCount: 2
	});

	const repliesTop2: V1Comment[] = [
		makeReply({
			postId,
			parentCommentId: 'c3',
			replyId: 'c3-r1',
			author: authorB,
			content: '回复 1：长评写得很认真。',
			createTime: String(nowMs - 90 * 1000),
			replyTo: { commentId: 'c3', ...pickUserIdentity(authorC) }
		}),
		makeReply({
			postId,
			parentCommentId: 'c3',
			replyId: 'c3-r2',
			author: authorA,
			content: '回复 2：赞同，信息量很大。',
			createTime: String(nowMs - 70 * 1000),
			replyTo: { commentId: 'c3-r1', ...pickUserIdentity(authorB) }
		})
	];

	const many: V1CommentWithReplies[] = [
		{ comment: top1, replies: repliesTop1, cursor: '' },
		{ comment: top2, replies: repliesTop2, cursor: '' }
	];

	for (let i = 4; i <= 28; i += 1) {
		const idx = String(i);
		const author = makeAuthor({ userId: `u${100 + i}`, name: `用户 ${idx}`, avatar: '' });
		const content =
			i % 5 === 0
				? makeLongCommentText(`c${idx}`)
				: `mock 评论 c${idx}：用于测试列表滚动与分隔线显示。`;

		const parentId = `c${idx}`;
		const top = makeCommentBase({
			commentId: parentId,
			postId,
			author,
			content,
			createTime: String(nowMs - i * 60 * 1000),
			likeCount: i % 7 === 0 ? 12 : i % 3,
			replyCount: 2
		});

		const rAuthor1 = makeAuthor({ userId: `u${200 + i}`, name: `回复者 ${idx}-A`, avatar: '' });
		const rAuthor2 = makeAuthor({ userId: `u${300 + i}`, name: `回复者 ${idx}-B`, avatar: '' });
		const replies: V1Comment[] = [
			makeReply({
				postId,
				parentCommentId: parentId,
				replyId: `${parentId}-r1`,
				author: rAuthor1,
				content: `回复 1：围观一下（${idx}）`,
				createTime: String(nowMs - i * 60 * 1000 + 10 * 1000),
				replyTo: { commentId: parentId, ...pickUserIdentity(author) }
			}),
			makeReply({
				postId,
				parentCommentId: parentId,
				replyId: `${parentId}-r2`,
				author: rAuthor2,
				content: `回复 2：同意楼上（${idx}）`,
				createTime: String(nowMs - i * 60 * 1000 + 25 * 1000),
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
