/**
 * PostDetail 专用 API 适配层
 *
 * **目的**：把 `PostDetail`、`CommentSection`、`EditCommentPopover` 需要的网络能力收敛为 `PostDetailApi`，
 * UI 只依赖该接口，便于单元测试与 `createMockPostDetailApi`（`api-mock.ts`）离线联调。
 *
 * **实现**
 * - `createRealPostDetailApi`：封装 `$lib/api` 各 service；评论媒体上传由调用方注入（Uppy 与路由生命周期绑定）。
 * - `createMockPostDetailApi`：内存态帖子/评论，带随机延迟，字段对齐 `types.gen.ts`。
 *
 * **关注态**：`UserFollowStatus` 与后端 `V1UserRelationStatus` 对齐（`isFollowing` / `isFollowedBy`），用于按钮文案与乐观更新。
 */

import type {
	V1Post,
	V1Comment,
	V1CommentWithReplies,
	V1CommentOrderType,
	V1CreateCommentRequest,
	V1MediaAsset,
	V1ReportCommentRequest
} from '$lib/api';
import {
	postServiceGetPost,
	postServiceSetPostLike,
	postServiceSetPostCollect,
	commentServiceListPostComments,
	commentServiceListCommentReplies,
	commentServiceSetCommentLike,
	commentServiceCreateComment,
	commentServiceDeleteComment,
	reportServiceReportComment,
	userServiceGetMe,
	userServiceGetUser,
	userServiceSetFollow
} from '$lib/api';

export interface UserFollowStatus {
	isFollowing: boolean;
	isFollowedBy: boolean;
}

/** `getMe` 返回，供底部输入条头像等使用 */
export type PostDetailMe = {
	userId: string;
	avatar?: string;
	name?: string;
};

export interface PostDetailApi {
	getPost(postId: string): Promise<{ post: V1Post }>;

	setPostLike(postId: string, isLiked: boolean): Promise<void>;
	setPostCollect(postId: string, isCollected: boolean): Promise<void>;

	getMe(): Promise<PostDetailMe>;
	getUser(userId: string): Promise<UserFollowStatus>;
	setFollow(userId: string, isFollowing: boolean): Promise<void>;

	listPostComments(
		postId: string,
		orderType: V1CommentOrderType,
		needNum: number,
		cursor?: string
	): Promise<{ comments: V1CommentWithReplies[]; cursor?: string }>;

	listCommentReplies(
		commentId: string,
		needNum: number,
		cursor?: string
	): Promise<{ replies: V1Comment[]; cursor?: string }>;

	setCommentLike(commentId: string, isLiked: boolean): Promise<void>;
	createComment(body: V1CreateCommentRequest): Promise<{ comment: V1Comment }>;
	deleteComment(commentId: string): Promise<void>;
	reportComment(body: V1ReportCommentRequest): Promise<void>;

	uploadCommentMedia(files: File[]): Promise<V1MediaAsset[]>;
}

/**
 * 真实 API 适配层：包装 sdk.gen 中的各 service 函数。
 * mediaUploader 由外部注入，因为它依赖 Uppy 实例（与组件生命周期绑定）。
 */
export function createRealPostDetailApi(deps: {
	uploadCommentMedia: (files: File[]) => Promise<V1MediaAsset[]>;
}): PostDetailApi {
	return {
		async getPost(postId) {
			const res = await postServiceGetPost({ path: { postId } });
			const post = res.data?.post;
			if (!post) throw new Error('帖子数据为空');
			return { post };
		},

		async setPostLike(postId, isLiked) {
			await postServiceSetPostLike({ path: { postId }, body: { isLiked } });
		},

		async setPostCollect(postId, isCollected) {
			await postServiceSetPostCollect({ path: { postId }, body: { isCollected } });
		},

		async getMe() {
			const res = await userServiceGetMe({});
			const profile = res.data?.profile;
			const userId = profile?.userId;
			if (!userId) throw new Error('获取用户信息失败');
			return {
				userId,
				avatar: profile.avatar,
				name: profile.name
			};
		},

		async getUser(userId) {
			const res = await userServiceGetUser({ path: { userId } });
			const relation = res.data?.relationStatus;
			return {
				isFollowing: relation?.isFollowing ?? false,
				isFollowedBy: relation?.isFollowedBy ?? false
			};
		},

		async setFollow(userId, isFollowing) {
			await userServiceSetFollow({ path: { userId }, body: { isFollowing } });
		},

		async listPostComments(postId, orderType, needNum, cursor) {
			const query: Record<string, unknown> = {
				order_type: orderType,
				'pagination.need_num': needNum
			};
			if (cursor) query['pagination.cursor'] = cursor;

			const res = await commentServiceListPostComments({
				path: { postId },
				query: query as never
			});
			const data = res.data;
			return {
				comments: data?.comments ?? [],
				cursor: data?.cursor
			};
		},

		async listCommentReplies(commentId, needNum, cursor) {
			const query: Record<string, unknown> = {
				'pagination.need_num': needNum
			};
			if (cursor) query['pagination.cursor'] = cursor;

			const res = await commentServiceListCommentReplies({
				path: { commentId },
				query: query as never
			});
			const data = res.data;
			return {
				replies: data?.replies ?? [],
				cursor: data?.cursor
			};
		},

		async setCommentLike(commentId, isLiked) {
			await commentServiceSetCommentLike({
				path: { commentId },
				body: { isLiked }
			});
		},

		async createComment(body) {
			const res = await commentServiceCreateComment({ body });
			const comment = res.data?.comment;
			if (!comment) throw new Error('创建评论失败');
			return { comment };
		},

		async deleteComment(commentId) {
			await commentServiceDeleteComment({ path: { commentId } });
		},

		async reportComment(body) {
			await reportServiceReportComment({ body });
		},

		uploadCommentMedia: deps.uploadCommentMedia
	};
}
