<script lang="ts">
	import {
		commentServiceListPostComments,
		commentServiceListCommentReplies,
		commentServiceSetCommentLike,
		commentServiceDeleteComment,
		reportServiceReportComment,
		type CommentServiceListPostCommentsData,
		type CommentServiceListCommentRepliesData,
		type CommentServiceSetCommentLikeBody,
		type CommentServiceDeleteCommentData,
		type ReportServiceReportCommentData,
		type V1Comment,
		type V1CommentWithFirstReply,
		type V1CommentOrderType,
		type V1ReportCommentRequest
	} from '$lib/api';
	import { Heart, MessageCircle, MoreHorizontal } from 'lucide-svelte';
	import { formatTimeAgo } from '$lib/time';
	import { cn } from '$lib/utils';
	import { resolve } from '$app/paths';

	/**
	 * 评论区 - 帖子详情内使用
	 * 使用 commentServiceListPostComments + V1CommentWithFirstReply 数据结构
	 */
	let {
		postId,
		initialCount,
		defaultOrder = 'COMMENT_ORDER_TYPE_MOST_LIKED' as V1CommentOrderType,
		useMock = false,
		mockComments,
		onReply,
		onTotalCountChange
	}: {
		postId: string;
		initialCount?: string | number;
		defaultOrder?: V1CommentOrderType;
		useMock?: boolean;
		mockComments?: V1CommentWithFirstReply[];
		onReply?: (comment: V1Comment) => void;
		onTotalCountChange?: (delta: number) => void;
	} = $props();

	/**
	 * 组件内部使用的评论结构：
	 * - 从接口 `V1CommentWithFirstReply` 扁平化为单条 `V1Comment`
	 * - 通过 `_replies`/_repliesCursor 等内部字段管理「仅展示一条最热回复 + 展开剩余回复」的 UI 逻辑
	 *
	 * 注意：不修改接口定义本身，只在前端做结构转换。
	 */
	type CommentWithReplies = V1Comment & {
		/**
		 * 当前已加载的回复列表（包括 first_reply 以及后续分页获取的回复）
		 */
		_replies?: V1Comment[];
		/**
		 * 用于继续通过 `ListCommentReplies` 拉取更多回复的游标
		 */
		_repliesCursor?: string;
		_repliesLoading?: boolean;
		/**
		 * 是否已经展开全部回复；未展开时仅展示一条（来自 first_reply 或最新一条）
		 */
		_repliesExpanded?: boolean;
	};

	let orderType = $state<V1CommentOrderType>(defaultOrder);
	let comments = $state<CommentWithReplies[]>([]);
	let cursor = $state<string | undefined>(undefined);
	let loading = $state(false);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);
	let totalCount = $state<number>(
		typeof initialCount === 'string' ? Number(initialCount) || 0 : (initialCount ?? 0)
	);

	const isMockEnabled = $derived(useMock && Array.isArray(mockComments));

	function ensureNumber(value: string | number | undefined | null): number {
		if (typeof value === 'number') return value;
		if (typeof value === 'string') return Number(value) || 0;
		return 0;
	}

	function mapApiComments(list: V1CommentWithFirstReply[] | undefined): CommentWithReplies[] {
		return (list ?? []).map((item) => {
			const base = item.comment ?? {};
			const firstReply = item.first_reply;

			return {
				...(base as V1Comment),
				_replies: firstReply ? [firstReply] : [],
				// first_reply_cursor 仅在存在第一条回复时才有意义
				_repliesCursor: item.first_reply_cursor,
				_repliesLoading: false,
				_repliesExpanded: false
			};
		});
	}

	async function fetchComments(append: boolean) {
		if (!postId || isMockEnabled) return;
		if (append && !cursor) return;

		if (append) loadingMore = true;
		else loading = true;
		error = null;

		try {
			const query: CommentServiceListPostCommentsData['query'] = {
				order_type: orderType,
				'pagination.need_num': 20
			};
			if (append && cursor) {
				query['pagination.cursor'] = cursor;
			}

			const res = await commentServiceListPostComments({
				path: { post_id: postId },
				query
			});

			const data = res.data;
			const list = mapApiComments(data?.comments);
			const nextCursor = data?.cursor;

			if (!append) {
				comments = list;
			} else {
				const byId = new SvelteMap<string, CommentWithReplies>();
				for (const c of comments) {
					byId.set(c.comment_id ?? '', c);
				}
				for (const c of list) {
					const id = c.comment_id ?? '';
					if (!byId.has(id)) {
						byId.set(id, c);
					}
				}
				comments = Array.from(byId.values());
			}

			cursor = nextCursor;
			if (data?.comments && totalCount === 0) {
				totalCount = data.comments.length;
			}
		} catch (err) {
			console.error('加载评论失败', err);
			error = '加载评论失败，请稍后重试';
		} finally {
			loading = false;
			loadingMore = false;
		}
	}

	async function loadMoreComments() {
		await fetchComments(true);
	}

	async function toggleOrder(type: V1CommentOrderType) {
		if (orderType === type) return;
		orderType = type;
		cursor = undefined;
		await fetchComments(false);
	}

	async function loadMoreReplies(comment: CommentWithReplies) {
		if (!comment.comment_id || comment._repliesLoading) return;

		comment._repliesLoading = true;
		try {
			const query: CommentServiceListCommentRepliesData['query'] = {
				'pagination.need_num': 20
			};
			if (comment._repliesCursor) {
				query['pagination.cursor'] = comment._repliesCursor;
			}

			const res = await commentServiceListCommentReplies({
				path: { comment_id: comment.comment_id },
				query
			});

			const data = res.data;
			const nextCursor = data?.cursor;
			const replies = data?.replies ?? [];

			const existing = comment._replies ?? [];
			const byId = new SvelteMap<string, V1Comment>();
			for (const r of existing) byId.set(r.comment_id ?? '', r);
			for (const r of replies) {
				const id = r.comment_id ?? '';
				if (!byId.has(id)) byId.set(id, r);
			}

			comment._replies = Array.from(byId.values());
			comment._repliesCursor = nextCursor;
			comment._repliesExpanded = true;
		} catch (err) {
			console.error('加载回复失败', err);
		} finally {
			comment._repliesLoading = false;
		}
	}

	async function handleToggleLike(target: V1Comment | CommentWithReplies) {
		if (!target.comment_id) return;

		const currentStatus = target.relation_status?.is_liked ?? false;
		const newStatus = !currentStatus;

		const patchTarget = target as V1Comment;
		const currentCount = ensureNumber(patchTarget.stats?.like_count);
		if (patchTarget.stats) {
			patchTarget.stats.like_count = String(currentCount + (newStatus ? 1 : -1));
		}
		if (patchTarget.relation_status) {
			patchTarget.relation_status.is_liked = newStatus;
		}

		const body: CommentServiceSetCommentLikeBody = {
			is_liked: newStatus
		};

		try {
			await commentServiceSetCommentLike({
				path: { comment_id: target.comment_id },
				body
			});
		} catch (err) {
			console.error('评论点赞失败', err);
			if (patchTarget.stats) {
				patchTarget.stats.like_count = String(currentCount);
			}
			if (patchTarget.relation_status) {
				patchTarget.relation_status.is_liked = currentStatus;
			}
		}
	}

	export function applyNewComment(newComment: V1Comment) {
		if (!newComment?.comment_id) return;

		const isReply = !!newComment.reply_context?.parent_comment_id;

		if (!isReply) {
			// 一级评论：直接扁平为 CommentWithReplies，初始不带任何回复
			const wrapped: CommentWithReplies = {
				...newComment,
				_replies: [],
				_repliesCursor: undefined,
				_repliesLoading: false,
				_repliesExpanded: false
			};
			comments = [wrapped, ...comments];
			totalCount = totalCount + 1;
			onTotalCountChange?.(1);
			return;
		}

		const parentId = newComment.reply_context?.parent_comment_id;
		if (!parentId) return;

		const list = [...comments];
		const target = list.find((c) => c.comment_id === parentId);
		if (!target) {
			comments = list;
			return;
		}

		const existing = target._replies ?? [];
		// 展开状态下插入到末尾；未展开时也会在内部列表中累积，为后续「展开全部回复」做准备
		target._replies = [...existing, newComment];

		const currentReplyCount = ensureNumber(target.stats?.reply_count);
		if (target.stats) {
			target.stats.reply_count = String(currentReplyCount + 1);
		}

		comments = list;
		totalCount = totalCount + 1;
		onTotalCountChange?.(1);
	}

	async function handleDeleteComment(comment: V1Comment | CommentWithReplies) {
		if (!comment.comment_id) return;

		if (!confirm('确定要删除这条评论吗？')) return;

		const commentId = comment.comment_id;

		try {
			// 根据 OpenAPI 生成的类型定义，这里仍需传入 url 字段以与后端定义保持一致
			const options: CommentServiceDeleteCommentData = {
				path: { comment_id: commentId },
				url: '/v1/comments/{comment_id}'
			};
			await commentServiceDeleteComment(options);

			let removedCount = 0;

			// 尝试作为顶层评论删除
			const topIndex = comments.findIndex((c) => c.comment_id === commentId);
			if (topIndex !== -1) {
				const top = comments[topIndex];
				const repliesLen = top._replies?.length ?? 0;
				removedCount = 1 + repliesLen;
				comments = comments.toSpliced(topIndex, 1);
			} else {
				// 尝试作为某个顶层评论的回复删除
				for (const c of comments) {
					if (!c._replies?.length) continue;
					const idx = c._replies.findIndex((r) => r.comment_id === commentId);
					if (idx !== -1) {
						c._replies = c._replies.toSpliced(idx, 1);
						removedCount = 1;

						const currentReplyCount = ensureNumber(c.stats?.reply_count);
						if (c.stats) {
							c.stats.reply_count = String(Math.max(0, currentReplyCount - 1));
						}
						break;
					}
				}
			}

			if (removedCount > 0) {
				totalCount = Math.max(0, totalCount - removedCount);
				onTotalCountChange?.(-removedCount);
			}
		} catch (err) {
			console.error('删除评论失败', err);
		}
	}

	async function handleReportComment(comment: V1Comment | CommentWithReplies) {
		if (!comment.comment_id) return;

		const body: V1ReportCommentRequest = {
			comment_id: comment.comment_id,
			post_id: comment.target_id ?? postId
		};

		try {
			// 同理，保持与 `ReportServiceReportCommentData` 的定义一致
			const options: ReportServiceReportCommentData = {
				body,
				url: '/v1/reports/comments'
			};
			await reportServiceReportComment(options);
			// 这里暂时只做静默处理，后续可接入全局 toast 系统
		} catch (err) {
			console.error('举报评论失败', err);
		}
	}

	$effect(() => {
		if (isMockEnabled) {
			// 使用 mock 数据时，只依赖 props（mockComments），避免因为依赖 comments 自身导致 $effect 死循环
			const mapped = mapApiComments(mockComments);
			comments = mapped;
			totalCount = mapped.length;
			cursor = undefined;
			return;
		}

		// 非 mock 场景：根据当前 postId / orderType / refreshTrigger 拉取评论
		fetchComments(false);
	});

	/**
	 * 判断当前评论是否还有未展开的回复数量
	 * - 接口层面的 reply_count 仅对「第一层评论」有意义
	 * - 这里保持完全依赖 stats.reply_count，不额外推断，保证与接口定义一致
	 */
	function getRemainingReplyCount(comment: CommentWithReplies): number {
		const total = ensureNumber(comment.stats?.reply_count);
		const loaded = comment._replies?.length ?? 0;
		return Math.max(0, total - loaded);
	}

	function toggleRepliesExpanded(comment: CommentWithReplies) {
		comment._repliesExpanded = !comment._repliesExpanded;
	}

	let activeMenuCommentId = $state<string | null>(null);

	function toggleActionMenu(comment: V1Comment | CommentWithReplies) {
		const id = comment.comment_id ?? null;
		activeMenuCommentId = activeMenuCommentId === id ? null : id;
	}

	function closeActionMenu() {
		activeMenuCommentId = null;
	}
</script>

<div
	class="mt-4 flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800"
>
	<span class="text-sm text-zinc-500">评论 {totalCount}</span>
	<div class="flex gap-2">
		<button
			class={cn(
				'text-sm transition',
				orderType === 'COMMENT_ORDER_TYPE_MOST_LIKED'
					? 'font-medium text-zinc-900 dark:text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
			)}
			onclick={() => toggleOrder('COMMENT_ORDER_TYPE_MOST_LIKED')}
		>
			最热
		</button>
		<button
			class={cn(
				'text-sm transition',
				orderType === 'COMMENT_ORDER_TYPE_LATEST'
					? 'font-medium text-zinc-900 dark:text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
			)}
			onclick={() => toggleOrder('COMMENT_ORDER_TYPE_LATEST')}
		>
			最新
		</button>
	</div>
</div>

{#if error}
	<p class="py-4 text-center text-sm text-red-500">{error}</p>
{/if}

<ul class="divide-y divide-zinc-200 dark:divide-zinc-800">
	{#each comments as comment (comment.comment_id)}
		<li class="py-3">
			<div class="flex gap-2">
				<a
					href={resolve(
						comment.author?.user_id ? `/app/profile/${comment.author.user_id}` : '/app/profile'
					)}
					class="shrink-0"
				>
					{#if comment.author?.avatar}
						<img class="size-8 rounded-full object-cover" src={comment.author.avatar} alt="" />
					{:else}
						<div class="size-8 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
					{/if}
				</a>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
							{comment.author?.name ?? '用户'}
						</span>
						<span class="text-xs text-zinc-500">
							{formatTimeAgo(comment.create_time ?? '')}
						</span>
					</div>
					{#if comment.reply_context?.reply_to_user_name}
						<p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
							回复 {comment.reply_context.reply_to_user_name}
						</p>
					{/if}
					<p class="mt-0.5 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
						{comment.content}
					</p>
					<div class="mt-2 flex items-center justify-between text-xs text-zinc-500">
						<div class="flex items-center gap-4">
							<button
								class="flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
								onclick={() => handleToggleLike(comment)}
							>
								<Heart
									class={cn(
										'size-3.5',
										comment.relation_status?.is_liked ? 'fill-rose-500 text-rose-500' : ''
									)}
								/>
								<span>{ensureNumber(comment.stats?.like_count)}</span>
							</button>

							<button
								class="flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
								onclick={() => onReply?.(comment)}
							>
								<MessageCircle class="size-3.5" />
								<span>{ensureNumber(comment.stats?.reply_count)}</span>
							</button>
						</div>

						<div class="relative">
							<button
								class="flex size-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
								onclick={() => toggleActionMenu(comment)}
								aria-label="更多操作"
							>
								<MoreHorizontal class="size-4" />
							</button>

							{#if activeMenuCommentId === comment.comment_id}
								<div
									class="absolute right-0 z-10 mt-1 w-28 rounded-md border border-zinc-200 bg-white py-1 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
								>
									<!-- 由于接口当前未返回“是否本人”或“可删除”字段，这里暂时同时展示两项。
										 实际权限仍由后端根据登录态校验。 -->
									<button
										class="flex w-full items-center px-3 py-1.5 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
										onclick={() => {
											handleDeleteComment(comment);
											closeActionMenu();
										}}
									>
										删除
									</button>
									<button
										class="flex w-full items-center px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
										onclick={() => {
											handleReportComment(comment);
											closeActionMenu();
										}}
									>
										举报
									</button>
								</div>
							{/if}
						</div>
					</div>

					{#if comment._replies && comment._replies.length > 0}
						<ul class="mt-2 space-y-2 border-l border-zinc-200 pl-3 text-xs dark:border-zinc-700">
							{#each comment._repliesExpanded ? comment._replies : comment._replies.slice(0, 1) as reply (reply.comment_id)}
								<li class="text-zinc-600 dark:text-zinc-300">
									<div class="flex items-start justify-between gap-2">
										<div class="min-w-0 flex-1">
											<span class="font-medium text-zinc-800 dark:text-zinc-100">
												{reply.author?.name ?? '用户'}
											</span>
											{#if reply.reply_context?.reply_to_user_name}
												<span class="font-medium text-zinc-800 dark:text-zinc-100">
													回复 {reply.reply_context.reply_to_user_name}
												</span>
											{/if}
											<span class="ml-2 text-zinc-500">
												{formatTimeAgo(reply.create_time ?? '')}
											</span>
											<p class="mt-0.5 whitespace-pre-wrap">
												{reply.content}
											</p>
											<div class="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
												<button
													class="flex items-center gap-0.5 rounded-full px-1 py-0.5 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
													onclick={() => handleToggleLike(reply)}
												>
													<Heart
														class={cn(
															'size-3',
															reply.relation_status?.is_liked ? 'fill-rose-500 text-rose-500' : ''
														)}
													/>
													<span>{ensureNumber(reply.stats?.like_count)}</span>
												</button>
												<button
													class="flex items-center gap-0.5 rounded-full px-1 py-0.5 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
													onclick={() => onReply?.(reply)}
												>
													<MessageCircle class="size-3" />
													<!-- 按要求：内部评论只展示回复图标，不展示回复数量 -->
												</button>
											</div>
										</div>

										<div class="relative ml-1 shrink-0">
											<button
												class="flex size-6 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
												onclick={() => toggleActionMenu(reply)}
												aria-label="更多操作"
											>
												<MoreHorizontal class="size-3.5" />
											</button>

											{#if activeMenuCommentId === reply.comment_id}
												<div
													class="absolute right-0 z-10 mt-1 w-28 rounded-md border border-zinc-200 bg-white py-1 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
												>
													<button
														class="flex w-full items-center px-3 py-1.5 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
														onclick={() => {
															handleDeleteComment(reply);
															closeActionMenu();
														}}
													>
														删除
													</button>
													<button
														class="flex w-full items-center px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
														onclick={() => {
															handleReportComment(reply);
															closeActionMenu();
														}}
													>
														举报
													</button>
												</div>
											{/if}
										</div>
									</div>
								</li>
							{/each}
						</ul>
					{/if}

					{#if ensureNumber(comment.stats?.reply_count) > 1}
						<div class="mt-1">
							{#if !comment._repliesExpanded}
								<button
									class="text-xs text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
									onclick={() => {
										// 优先使用已经在 stats 中暴露的总回复数，保持与接口定义一致
										if (getRemainingReplyCount(comment) > 0 && !comment._repliesCursor) {
											// 接口没有额外字段指示“是否还有更多分页”，这里只在有游标时才发起网络请求
											loadMoreReplies(comment);
										} else if (comment._repliesCursor) {
											loadMoreReplies(comment);
										}
										toggleRepliesExpanded(comment);
									}}
									disabled={comment._repliesLoading}
								>
									{comment._repliesLoading
										? '加载回复中…'
										: `展开 ${Math.max(
												1,
												ensureNumber(comment.stats?.reply_count) - (comment._replies?.length ?? 0)
											)} 条回复`}
								</button>
							{:else if getRemainingReplyCount(comment) > 0}
								<!-- 已展开但仍有更多分页数据时，继续加载 -->
								<button
									class="text-xs text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
									onclick={() => loadMoreReplies(comment)}
									disabled={comment._repliesLoading}
								>
									{comment._repliesLoading
										? '加载回复中…'
										: `还有 ${getRemainingReplyCount(comment)} 条回复，点击展开`}
								</button>
							{:else}
								<button
									class="text-xs text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
									onclick={() => toggleRepliesExpanded(comment)}
								>
									收起回复
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</li>
	{/each}
</ul>

{#if loading && comments.length === 0}
	<p class="py-4 text-center text-sm text-zinc-500">加载评论中…</p>
{:else if !loading && comments.length === 0}
	<p class="py-4 text-center text-sm text-zinc-500">暂无评论</p>
{/if}

{#if cursor}
	<button
		class="w-full py-2 text-sm text-zinc-500 transition hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300"
		onclick={loadMoreComments}
		disabled={loadingMore}
	>
		{loadingMore ? '加载中…' : '加载更多'}
	</button>
{/if}
