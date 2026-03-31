/**
 * PostDetail Mock API（`PostDetailApi` 实现）
 *
 * **数据**：初始帖子与评论来自 `$lib/test/post-detail`（`getMockPost` / `getMockPostComments`），`createMockPostDetailApi(postId?)` 为每个调试会话生成独立内存副本。
 *
 * **行为**：点赞/收藏/关注/发评/删评等会改同一内存对象；`listPostComments` 按 `V1CommentOrderType` 排序（如「最新」为创建时间降序）；请求统一带随机延迟以暴露加载态与竞态问题。
 *
 * **用途**：无后端时联调 UI（推荐配合 `post-detail-debug` 路由）。字段形状与 `types.gen.ts` 一致（camelCase）。
 */

import type {
	V1Comment,
	V1CommentWithReplies,
	V1CommentOrderType,
	V1CreateCommentRequest,
	V1MediaAsset,
	V1Post
} from '$lib/api';
import { getMockPost, getMockPostComments } from '$lib/test/post-detail';
import type { PostDetailApi } from './api';

function delay(min = 120, max = 400): Promise<void> {
	const ms = min + Math.random() * (max - min);
	return new Promise((r) => setTimeout(r, ms));
}

const MOCK_CURRENT_USER_ID = 'mock-current-user';

export function createMockPostDetailApi(postId?: string): PostDetailApi {
	const id = postId ?? `mock-${crypto.randomUUID().slice(0, 8)}`;

	const post: V1Post = getMockPost(id);
	const comments: V1CommentWithReplies[] = getMockPostComments(id);
	let isFollowing = false;
	const isFollowedBy = Math.random() > 0.5;

	function findCommentById(
		commentId: string
	): { comment: V1Comment; parent?: V1CommentWithReplies } | null {
		for (const item of comments) {
			if (item.comment.commentId === commentId) {
				return { comment: item.comment };
			}
			for (const reply of item.replies) {
				if (reply.commentId === commentId) {
					return { comment: reply, parent: item };
				}
			}
		}
		return null;
	}

	function sortComments(order: V1CommentOrderType): V1CommentWithReplies[] {
		const list = [...comments];
		const byTimeDesc = (a: V1CommentWithReplies, b: V1CommentWithReplies) =>
			Number(b.comment.createTime) - Number(a.comment.createTime);
		const byTimeAsc = (a: V1CommentWithReplies, b: V1CommentWithReplies) =>
			Number(a.comment.createTime) - Number(b.comment.createTime);

		switch (order) {
			case 'COMMENT_ORDER_TYPE_MOST_LIKED':
				list.sort((a, b) => {
					const la = Number(a.comment.stats?.likeCount ?? '0');
					const lb = Number(b.comment.stats?.likeCount ?? '0');
					return lb - la;
				});
				break;
			case 'COMMENT_ORDER_TYPE_LEAST_LIKED':
				list.sort((a, b) => {
					const la = Number(a.comment.stats?.likeCount ?? '0');
					const lb = Number(b.comment.stats?.likeCount ?? '0');
					return la - lb;
				});
				break;
			case 'COMMENT_ORDER_TYPE_EARLIEST':
				list.sort(byTimeAsc);
				break;
			case 'COMMENT_ORDER_TYPE_MOST_REPLIES':
				list.sort((a, b) => {
					const ra = Number(a.comment.stats?.replyCount ?? '0');
					const rb = Number(b.comment.stats?.replyCount ?? '0');
					return rb - ra;
				});
				break;
			case 'COMMENT_ORDER_TYPE_LEAST_REPLIES':
				list.sort((a, b) => {
					const ra = Number(a.comment.stats?.replyCount ?? '0');
					const rb = Number(b.comment.stats?.replyCount ?? '0');
					return ra - rb;
				});
				break;
			case 'COMMENT_ORDER_TYPE_LATEST':
			case 'COMMENT_ORDER_TYPE_UNSPECIFIED':
			default:
				// 与 types.gen 约定一致：LATEST = 按创建时间降序（新在上）
				list.sort(byTimeDesc);
		}
		return list;
	}

	return {
		async getPost() {
			await delay();
			return { post };
		},

		async setPostLike(_postId, isLiked) {
			await delay(80, 200);
			if (post.relationStatus) {
				post.relationStatus.isLiked = isLiked;
			}
			const stats = post.stats;
			if (stats) {
				const c = Number(stats.likeCount ?? '0') || 0;
				stats.likeCount = String(c + (isLiked ? 1 : -1));
			}
		},

		async setPostCollect(_postId, isCollected) {
			await delay(80, 200);
			if (post.relationStatus) {
				post.relationStatus.isCollected = isCollected;
			}
			const stats = post.stats;
			if (stats) {
				const c = Number(stats.collectCount ?? '0') || 0;
				stats.collectCount = String(c + (isCollected ? 1 : -1));
			}
		},

		async getMe() {
			await delay(60, 150);
			return { userId: MOCK_CURRENT_USER_ID };
		},

		async getUser() {
			await delay(60, 150);
			return { isFollowing, isFollowedBy };
		},

		async setFollow(_userId, follow) {
			await delay(80, 200);
			isFollowing = follow;
		},

		async listPostComments(_postId, orderType, needNum, cursor) {
			await delay();
			const sorted = sortComments(orderType);
			const offset = cursor ? parseInt(cursor, 10) : 0;
			const page = sorted.slice(offset, offset + needNum);
			const nextOffset = offset + needNum;
			const hasMore = nextOffset < sorted.length;
			return {
				comments: page,
				cursor: hasMore ? String(nextOffset) : undefined
			};
		},

		async listCommentReplies(commentId, needNum, cursor) {
			await delay();
			const top = comments.find((item) => item.comment.commentId === commentId);
			const allReplies = top?.replies ?? [];
			const offset = cursor ? parseInt(cursor, 10) : 0;
			const page = allReplies.slice(offset, offset + needNum);
			const nextOffset = offset + needNum;
			const hasMore = nextOffset < allReplies.length;
			return {
				replies: page,
				cursor: hasMore ? String(nextOffset) : undefined
			};
		},

		async setCommentLike(commentId, isLiked) {
			await delay(60, 150);
			const found = findCommentById(commentId);
			if (!found) return;
			const c = found.comment;
			c.relationStatus.isLiked = isLiked;
			const n = Number(c.stats.likeCount ?? '0') || 0;
			c.stats.likeCount = String(n + (isLiked ? 1 : -1));
		},

		async createComment(body: V1CreateCommentRequest) {
			await delay(150, 350);
			const newComment: V1Comment = {
				commentId: `mock-c-${crypto.randomUUID().slice(0, 8)}`,
				targetId: body.targetId,
				targetType: body.targetType,
				content: body.content,
				createTime: String(Date.now()),
				author: {
					userId: MOCK_CURRENT_USER_ID,
					name: '当前用户 (Mock)',
					avatar: '',
					qqNumber: '',
					role: 'ROLE_USER'
				},
				media: body.media ?? [],
				stats: { likeCount: '0', replyCount: '0' },
				relationStatus: { isLiked: false },
				replyContext: body.replyContext
			};

			if (body.replyContext?.parentCommentId) {
				const parent = comments.find((item) => {
					return item.comment.commentId === body.replyContext!.parentCommentId;
				});
				if (parent) {
					parent.replies = [...parent.replies, newComment];
					const pStats = parent.comment.stats;
					const n = Number(pStats.replyCount ?? '0') || 0;
					pStats.replyCount = String(n + 1);
				}
			} else {
				comments.unshift({
					comment: newComment,
					replies: [],
					cursor: ''
				});
			}

			const stats = post.stats;
			if (stats) {
				const n = Number(stats.commentCount ?? '0') || 0;
				stats.commentCount = String(n + 1);
			}

			return { comment: newComment };
		},

		async deleteComment(commentId) {
			await delay(100, 250);
			const topIdx = comments.findIndex((item) => item.comment.commentId === commentId);
			if (topIdx !== -1) {
				const top = comments[topIdx];
				const removedCount = 1 + top.replies.length;
				comments.splice(topIdx, 1);
				const stats = post.stats;
				if (stats) {
					const n = Number(stats.commentCount ?? '0') || 0;
					stats.commentCount = String(Math.max(0, n - removedCount));
				}
				return;
			}

			for (const item of comments) {
				const rIdx = item.replies.findIndex((r) => r.commentId === commentId);
				if (rIdx !== -1) {
					item.replies = item.replies.filter((_, i) => i !== rIdx);
					const pStats = item.comment.stats;
					const n = Number(pStats.replyCount ?? '0') || 0;
					pStats.replyCount = String(Math.max(0, n - 1));
					const stats = post.stats;
					if (stats) {
						const cn = Number(stats.commentCount ?? '0') || 0;
						stats.commentCount = String(Math.max(0, cn - 1));
					}
					return;
				}
			}
		},

		async reportComment() {
			await delay(100, 250);
		},

		async uploadCommentMedia(files: File[]): Promise<V1MediaAsset[]> {
			await delay(200, 500);
			return files.map((f, i) => ({
				assetId: `mock-media-${i}-${Date.now()}`,
				type: 'MEDIA_TYPE_IMAGE',
				scene: 'MEDIA_SCENE_COMMENT_MEDIA',
				status: 'MEDIA_STATUS_COMPLETED',
				orderIndex: i,
				single: {
					fileId: `mock-file-${i}`,
					type: 'MEDIA_TYPE_IMAGE',
					bucket: 'mock',
					objectKey: f.name,
					url: URL.createObjectURL(f),
					meta: {
						width: 200,
						height: 200,
						durationMs: '0',
						sizeBytes: String(f.size || 0),
						mimeType: f.type || 'application/octet-stream'
					},
					status: 'MEDIA_STATUS_COMPLETED'
				}
			}));
		}
	};
}
