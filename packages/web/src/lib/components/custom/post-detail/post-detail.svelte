<script lang="ts">
	/**
	 * @component
	 * ## PostDetail - 帖子详情弹窗
	 *
	 * 全屏/弹窗式帖子详情组件，展示帖子内容、媒体、作者信息、评论区及交互操作。
	 * 支持通过 post 属性直接传入数据，或通过 postId 从 API 获取。
	 *
	 * ### 功能特性
	 *
	 * - **媒体展示**：左侧/顶部展示图片/视频，支持滑动切换；点击进入全屏预览
	 * - **作者信息**：展示头像、昵称、部门/认证标签，关注按钮
	 * - **正文展示**：标题+内容，支持长内容折叠（超过1000字显示"查看全文"）
	 * - **交互操作**：点赞、收藏、评论、分享
	 * - **评论区**：集成 CommentSection 组件，支持评论展示、回复、点赞、删除
	 * - **响应式布局**：桌面端左右分栏，移动端上下布局
	 *
	 * ### 使用方式
	 *
	 * **1. 通过 postId 从 API 获取**
	 * ```svelte
	 * <PostDetail postId="xxx" onClose={() => {}} />
	 * ```
	 *
	 * **2. 直接传入 post 数据**
	 * ```svelte
	 * <PostDetail post={postData} onClose={() => {}} />
	 * ```
	 *
	 * ### Props
	 *
	 * | 属性 | 类型 | 默认值 | 说明 |
	 * |------|------|--------|------|
	 * | post | V1Post | - | 直接传入的帖子数据（可选） |
	 * | postId | string | - | 帖子 ID，从 API 获取时使用 |
	 * | showComments | boolean | true | 是否展示评论区 |
	 * | onClose | () => void | - | 关闭弹窗时的回调 |
	 *
	 * ### 回调说明
	 *
	 * - onClose: 点击关闭按钮/遮罩/按 ESC 时调用，由父组件控制是否卸载
	 */

	import type {
		V1Post as Post,
		V1Comment,
		V1CreateCommentRequest,
		V1CommentTargetType
	} from '$lib/api';
	import type { Snippet } from 'svelte';
	import {
		postServiceGetPost,
		postServiceSetPostLike,
		postServiceSetPostCollect,
		commentServiceCreateComment,
		userServiceSetFollow,
		userServiceGetMe,
		userServiceGetUser,
		type UserServiceSetFollowBody
	} from '$lib/api';
	import { formatTimeAgo } from '$lib/time';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { X, Heart, MessageCircle, Star, Share, LoaderCircle } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { resolve } from '$app/paths';
	import PostMediaArea from '$lib/components/custom/post-detail/post-media-area.svelte';
	import CommentSection from '$lib/components/custom/comment-section/comment-section.svelte';
	import { EditCommentPopover } from '$lib/components/custom/edit-comment-popover';
	import { UserProfilePopover } from '$lib/components/custom/user-profile-popover';
	let {
		post: initialPost,
		postId,
		showComments = true,
		comments,
		onClose
	}: {
		/** 直接传入的帖子数据（可选，用于已有数据直出渲染） */
		post?: Post;
		/** 帖子 ID（可选，如果提供则从 API 获取） */
		postId?: string;
		/** 是否展示评论区 */
		showComments?: boolean;
		/**
		 * 可选：自定义评论区内容。
		 * - 不传：组件内部渲染默认评论区（走真实 API）
		 * - 传入：由父组件完全接管评论区渲染
		 */
		comments?: Snippet<
			[
				{
					postId: string;
					currentUserId: string | null;
					initialCount: string | number | undefined;
					onReply: (comment: V1Comment) => void;
					onTotalCountChange: (delta: number) => void;
				}
			]
		>;
		/** 可选：点击关闭按钮/遮罩时的回调，由父组件控制是否卸载 Stack */
		onClose?: () => void;
	} = $props();

	let post = $state<Post | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let isLiking = $state(false);
	let isCollecting = $state(false);
	let isFollowingAction = $state(false); // 关注操作进行中状态
	let isFetchingFollowing = $state(false); // 获取关注状态中
	let currentUserId = $state<string | null>(null);
	let actionError = $state<string | null>(null); // 用于局部错误提示，不影响整个弹窗
	let notification = $state<string | null>(null); // 用于成功提示
	let isFollowing = $state(false); // 关注状态，从 userServiceGetUser 获取
	// 用户资料 Popover 状态
	let isUserProfilePopoverOpen = $state(false);
	let pendingUserProfileUserId = $state<string | null>(null);

	// 监听 initialPost 变化，更新 post
	$effect(() => {
		if (initialPost) {
			post = initialPost;
			error = null;
			isLoading = false;
		}
	});

	// 如果提供了 postId 且没有 initialPost，则从 API 获取数据
	$effect(() => {
		if (postId && !initialPost) {
			// 清空之前的数据
			post = null;
			error = null;
			fetchPost(postId);
		}
	});

	// 获取当前用户信息，用于判断关注状态
	$effect(() => {
		async function fetchCurrentUser() {
			try {
				const response = await userServiceGetMe({});
				if (response.data?.profile?.user_id) {
					currentUserId = response.data.profile.user_id;
				}
			} catch (err) {
				console.error('获取当前用户信息失败:', err);
				// 静默失败，不影响主流程
			}
		}
		fetchCurrentUser();
	});

	// 通过 userServiceGetUser 获取作者的关注状态
	$effect(() => {
		async function fetchFollowingStatus() {
			// 需要同时有 post、作者 ID、当前用户 ID 且不是自己
			if (!post?.author?.user_id || !currentUserId || post.author.user_id === currentUserId) {
				isFollowing = false;
				return;
			}

			isFetchingFollowing = true;
			try {
				const response = await userServiceGetUser({
					path: { user_id: post.author.user_id }
				});
				isFollowing = response.data?.relation_status?.is_following ?? false;
			} catch (err) {
				console.error('获取关注状态失败:', err);
				isFollowing = false;
			} finally {
				isFetchingFollowing = false;
			}
		}
		fetchFollowingStatus();
	});

	async function fetchPost(id: string) {
		isLoading = true;
		error = null;
		actionError = null;
		try {
			const response = await postServiceGetPost({
				path: { post_id: id }
			});
			if (response.data?.post) {
				post = response.data.post;
			} else {
				error = '帖子不存在';
			}
		} catch (err) {
			console.error('获取帖子详情失败:', err);
			error = err instanceof Error ? err.message : '获取帖子详情失败';
		} finally {
			isLoading = false;
		}
	}

	async function handleLike() {
		if (!post?.post_id || isLiking) return;

		const currentIsLiked = post.relation_status?.is_liked ?? false;
		const newIsLiked = !currentIsLiked;

		// 乐观更新
		if (post.stats) {
			const currentCount = Number(post.stats.like_count ?? '0') || 0;
			post.stats.like_count = String(currentCount + (newIsLiked ? 1 : -1));
		}
		if (post.relation_status) {
			post.relation_status.is_liked = newIsLiked;
		}

		isLiking = true;
		try {
			await postServiceSetPostLike({
				path: { post_id: post.post_id },
				body: { is_liked: newIsLiked }
			});
		} catch (err) {
			console.error('点赞操作失败:', err);
			// 回滚乐观更新
			if (post.stats) {
				const currentCount = Number(post.stats.like_count ?? '0') || 0;
				post.stats.like_count = String(currentCount + (newIsLiked ? -1 : 1));
			}
			if (post.relation_status) {
				post.relation_status.is_liked = currentIsLiked;
			}
			actionError = '点赞操作失败，请重试';
		} finally {
			isLiking = false;
		}
	}

	async function handleCollect() {
		if (!post?.post_id || isCollecting) return;

		const currentIsCollected = post.relation_status?.is_collected ?? false;
		const newIsCollected = !currentIsCollected;

		// 乐观更新
		if (post.stats) {
			const currentCount = Number(post.stats.collect_count ?? '0') || 0;
			post.stats.collect_count = String(currentCount + (newIsCollected ? 1 : -1));
		}
		if (post.relation_status) {
			post.relation_status.is_collected = newIsCollected;
		}

		isCollecting = true;
		actionError = null;
		try {
			await postServiceSetPostCollect({
				path: { post_id: post.post_id },
				body: { is_collected: newIsCollected }
			});
		} catch (err) {
			console.error('收藏操作失败:', err);
			// 回滚乐观更新
			if (post.stats) {
				const currentCount = Number(post.stats.collect_count ?? '0') || 0;
				post.stats.collect_count = String(currentCount + (newIsCollected ? -1 : 1));
			}
			if (post.relation_status) {
				post.relation_status.is_collected = currentIsCollected;
			}
			actionError = '收藏操作失败，请重试';
		} finally {
			isCollecting = false;
		}
	}

	async function handleFollow() {
		// 未登录：触发登录引导（占位）
		if (!currentUserId) {
			// TODO: 实现登录功能后，替换为实际的登录弹窗触发
			actionError = '请先登录后再关注';
			return;
		}

		// 并发控制
		if (!post?.author?.user_id || isFollowingAction) return;

		actionError = null; // 清除之前的错误提示
		const currentIsFollowing = isFollowing;
		const newIsFollowing = !currentIsFollowing;

		// 乐观更新
		isFollowing = newIsFollowing;

		isFollowingAction = true;
		try {
			const body: UserServiceSetFollowBody = {
				is_following: newIsFollowing
			};
			await userServiceSetFollow({
				path: { user_id: post.author.user_id },
				body
			});
		} catch (err) {
			console.error('关注操作失败:', err);
			// 回滚乐观更新
			isFollowing = currentIsFollowing;
			actionError = '关注操作失败，请重试';
		} finally {
			isFollowingAction = false;
		}
	}

	async function handleShare() {
		if (!post) return;

		try {
			const postTitle = post.title || '帖子';
			const postUrl = `${window.location.origin}${resolve('/app/home')}?post_id=${post.post_id}`;
			const shareText = `【${postTitle}】${postUrl}`;

			// 使用 Clipboard API
			await navigator.clipboard.writeText(shareText);

			// 显示成功提示
			actionError = null;
			notification = '已复制分享链接至剪切板，快去分享给好友吧！';
			// 3秒后自动关闭通知
			setTimeout(() => {
				notification = null;
			}, 3000);
		} catch (err) {
			console.error('分享失败:', err);
			actionError = '分享失败，请重试';
		}
	}

	const author = $derived(post?.author);
	const departments = $derived(author?.departments ?? []);
	const publishLabel = $derived(formatTimeAgo(post?.publish_time ?? ''));

	const CONTENT_LIMIT = 1000;
	const rawContent = $derived(post?.content ?? '');
	const hasLongContent = $derived(rawContent.length > CONTENT_LIMIT);
	let isContentExpanded = $state(false);

	type CommentSectionHandle = {
		applyNewComment: (comment: V1Comment) => void;
	};

	let commentSectionRef = $state<CommentSectionHandle | null>(null);
	let commentSectionEl = $state<HTMLElement | null>(null);
	let commentEditorOpen = $state(false);
	let commentReplyTo = $state<V1Comment | null>(null);

	function getDisplayedContent() {
		if (!hasLongContent || isContentExpanded) return rawContent;
		return rawContent.slice(0, CONTENT_LIMIT) + '…';
	}

	function handleClose() {
		onClose?.();
	}

	function scrollToComments() {
		if (commentSectionEl) {
			commentSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function openCommentEditor(target: V1Comment | null = null) {
		commentReplyTo = target;
		commentEditorOpen = true;
	}

	function handleCommentCountChange(delta: number) {
		if (!post?.stats) return;
		const raw = post.stats.comment_count;
		const current = Number(raw ?? '0') || 0;
		const next = Math.max(0, current + delta);
		post.stats.comment_count = String(next);
	}

	async function handleSubmitComment(content: string, replyTo: V1Comment | null) {
		if (!post?.post_id) return;

		const body: V1CreateCommentRequest = {
			target_id: post.post_id,
			target_type: 'COMMENT_TARGET_TYPE_POST' as V1CommentTargetType,
			content
		};

		if (replyTo && replyTo.comment_id) {
			const parentId = replyTo.reply_context?.parent_comment_id ?? replyTo.comment_id;
			body.reply_context = {
				parent_comment_id: parentId,
				reply_to_comment_id: replyTo.comment_id,
				reply_to_user_id: replyTo.author?.user_id,
				reply_to_user_name: replyTo.author?.name
			};
		}

		try {
			const res = await commentServiceCreateComment({ body });
			const newComment = res.data?.comment;
			if (newComment) {
				commentSectionRef?.applyNewComment(newComment);
			}
		} catch (err) {
			console.error('发布评论失败', err);
		} finally {
			commentEditorOpen = false;
			commentReplyTo = null;
		}
	}
</script>

{#if isLoading}
	<!-- 加载状态 -->
	<div
		class="scrollbar-hide fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="加载中"
	>
		<div
			class={cn(
				'absolute inset-0 lg:inset-y-6 lg:right-1/7 lg:left-1/7',
				'flex items-center justify-center'
			)}
		>
			<div
				class={cn(
					'flex h-full w-full flex-col items-center justify-center bg-zinc-100 text-zinc-900',
					'lg:h-auto lg:max-h-[calc(100vh-3rem)] lg:rounded-2xl',
					'dark:bg-zinc-900 dark:text-zinc-50',
					'rounded-none shadow-xl'
				)}
			>
				<LoaderCircle class="size-8 animate-spin text-zinc-500" />
				<p class="mt-4 text-sm text-zinc-500">加载中...</p>
			</div>
		</div>
	</div>
{:else if error}
	<!-- 错误状态 -->
	<div
		class="scrollbar-hide fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="错误"
		onclick={(e) => {
			if (e.currentTarget === e.target) handleClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				if (e.currentTarget === e.target) handleClose();
			}
		}}
	>
		<div
			class={cn(
				'absolute inset-0 lg:inset-y-6 lg:right-1/7 lg:left-1/7',
				'flex items-center justify-center'
			)}
		>
			<div
				class={cn(
					'flex h-full w-full flex-col items-center justify-center bg-zinc-100 text-zinc-900',
					'lg:h-auto lg:max-h-[calc(100vh-3rem)] lg:rounded-2xl',
					'dark:bg-zinc-900 dark:text-zinc-50',
					'rounded-none px-6 shadow-xl'
				)}
			>
				<p class="text-sm text-red-500">{error}</p>
				<Button variant="default" class="mt-4" onclick={handleClose}>关闭</Button>
			</div>
		</div>
	</div>
{:else if post}
	<!-- Stack 布局容器：覆盖 app 内容的全屏弹层 -->
	<div
		class="scrollbar-hide fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="帖子详情"
		onclick={(e) => {
			// 仅点击遮罩时关闭，避免内容点击误触
			if (e.currentTarget === e.target) handleClose();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				handleClose();
			}
		}}
	>
		<div
			class={cn(
				'absolute inset-0 lg:inset-y-6 lg:right-1/7 lg:left-1/7',
				'flex items-stretch justify-center'
			)}
		>
			<!-- 关闭按钮（桌面端：保持原来的左上角悬浮位置；移动端隐藏） -->
			<div class="absolute top-4 left-4 z-10 hidden lg:flex">
				<Button
					variant="ghost"
					size="icon"
					class="min-h-11 min-w-11 cursor-pointer rounded-full bg-zinc-900/60 text-zinc-100 hover:bg-zinc-900/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-800"
					aria-label="关闭"
					onclick={handleClose}
				>
					<X class="size-5" />
				</Button>
			</div>

			<div
				class={cn(
					'max-w-10xl flex h-full w-full flex-col bg-zinc-100 text-zinc-900',
					'lg:h-auto lg:max-h-[calc(100vh-3rem)] lg:flex-row',
					'dark:bg-zinc-900 dark:text-zinc-50',
					'rounded-none shadow-xl lg:rounded-2xl'
				)}
			>
				<div class={cn('hidden shrink-0 lg:flex lg:h-auto lg:w-1/2')}>
					<PostMediaArea mediaList={post.media ?? []} postTitle={post.title ?? ''} />
				</div>

				<!-- 文本与操作区：头部 + 中间滚动区（含移动端媒体区）+ 底部操作栏 -->
				<div class="flex h-full grow flex-col lg:w-1/2">
					<!-- 作者信息与统计 -->
					<div class="flex-none px-4 pt-4 pb-4 lg:px-6 lg:pt-6 lg:pb-4">
						<div class="flex min-w-0 items-center gap-3">
							<!-- 关闭按钮（移动端：头像左侧；桌面端：隐藏，使用左侧区域的悬浮关闭按钮时机，如后续需要） -->
							<div class="flex lg:hidden">
								<Button
									variant="ghost"
									size="icon"
									class="min-h-10 min-w-10 cursor-pointer rounded-full bg-zinc-200/80 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:bg-zinc-700"
									aria-label="关闭"
									onclick={handleClose}
								>
									<X class="size-5" />
								</Button>
							</div>
							<!-- TODO: Stack 基建完成后，非本人用户使用 UserProfilePopover 打开 -->
							{#if author?.user_id && currentUserId && author.user_id === currentUserId}
								<a href={resolve('/app/profile')} class="cursor-pointer">
									{#if author?.avatar}
										<img
											src={author.avatar}
											alt={author.name ?? '用户头像'}
											class="size-11 rounded-full object-cover"
										/>
									{:else}
										<div
											class="flex size-11 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
										>
											{author?.name?.slice(0, 1) ?? 'U'}
										</div>
									{/if}
								</a>
							{:else}
								<button
									type="button"
									class="cursor-pointer"
									onclick={() => {
										if (author?.user_id) {
											pendingUserProfileUserId = author.user_id;
											isUserProfilePopoverOpen = true;
										}
									}}
								>
									{#if author?.avatar}
										<img
											src={author.avatar}
											alt={author.name ?? '用户头像'}
											class="size-11 rounded-full object-cover"
										/>
									{:else}
										<div
											class="flex size-11 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
										>
											{author?.name?.slice(0, 1) ?? 'U'}
										</div>
									{/if}
								</button>
							{/if}

							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<p
										class="cursor-text truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50"
									>
										{author?.name ?? '用户'}
									</p>
								</div>
								<div class="scrollbar-hide mt-1 flex max-w-full gap-1 overflow-x-auto pb-1">
									{#if author?.verified_title}
										<Badge
											variant="secondary"
											class="max-w-32 truncate bg-amber-50 text-xs font-normal text-amber-700"
										>
											{author.verified_title}
										</Badge>
									{/if}
									{#if departments.length > 0}
										{#each departments as dept (dept.id)}
											<Badge
												variant="outline"
												class="border-zinc-200 bg-rose-50 text-xs whitespace-nowrap text-red-500 dark:border-zinc-700"
											>
												{dept.name}
											</Badge>
										{/each}
									{/if}
								</div>
							</div>
							<div class="ml-auto flex flex-col items-end gap-2">
								{#if post.author?.user_id && post.author.user_id !== currentUserId}
									<Button
										variant="default"
										class="text-md min-w-20 cursor-pointer font-bold"
										disabled={isFollowingAction || isFetchingFollowing}
										onclick={handleFollow}
									>
										{#if isFollowingAction || isFetchingFollowing}
											<LoaderCircle class="mr-1 size-4 animate-spin" />
										{/if}
										{isFollowing ? '已关注' : '关注'}
									</Button>
								{:else if !currentUserId}
									<!-- 未登录用户显示关注按钮，点击引导登录 -->
									<Button
										variant="default"
										class="text-md min-w-20 font-bold"
										onclick={() => {
											actionError = '请先登录后再关注';
										}}
									>
										关注
									</Button>
								{/if}
							</div>
						</div>
					</div>
					<div class="scrollbar-hide flex-1 overflow-y-auto px-4 pb-4 lg:px-6 lg:pb-4">
						<div class={cn('mb-4 lg:hidden', 'h-[60vh]')}>
							<PostMediaArea mediaList={post.media ?? []} postTitle={post.title ?? ''} />
						</div>
						<!-- 标题与正文 -->
						<div class="mt-4 space-y-3">
							{#if post.title}
								<h1
									class="cursor-text text-base leading-snug font-semibold text-zinc-900 dark:text-zinc-50"
								>
									{post.title}
								</h1>
							{/if}

							{#if rawContent}
								<div class="space-y-1">
									<p
										class="cursor-text text-sm leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-200"
									>
										{getDisplayedContent()}
									</p>
									{#if hasLongContent}
										<button
											class="mt-1 cursor-pointer text-xs font-medium text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
											onclick={() => (isContentExpanded = !isContentExpanded)}
										>
											{isContentExpanded ? '收起内容' : '查看全文'}
										</button>
									{/if}
								</div>
								<p class="mt-1 cursor-text text-xs text-zinc-500">
									{#if publishLabel}{publishLabel}{/if}
								</p>
							{/if}
						</div>

						<!-- 评论区 -->
						{#if showComments}
							<div class="mt-6" bind:this={commentSectionEl}>
								{#if post.post_id}
									{#if comments}
										{@render comments({
											postId: post.post_id,
											currentUserId,
											initialCount: post.stats?.comment_count,
											onReply: openCommentEditor,
											onTotalCountChange: handleCommentCountChange
										})}
									{:else}
										<CommentSection
											bind:this={commentSectionRef}
											postId={post.post_id}
											{currentUserId}
											initialCount={post.stats?.comment_count}
											onReply={openCommentEditor}
											onTotalCountChange={handleCommentCountChange}
										/>
									{/if}
								{/if}
							</div>
						{/if}
					</div>

					<!-- 底部操作栏 -->
					<div class="flex-none border-t border-zinc-200 dark:border-zinc-800">
						<div class="flex items-center justify-between gap-0 px-4 py-2 lg:px-6">
							<!-- 输入框触发器：统一使用 Popover + EditCommentPopover 作为编辑入口 -->
							<Popover.Popover bind:open={commentEditorOpen}>
								<Popover.PopoverTrigger
									class="flex min-h-11 flex-1 items-center gap-2 rounded-full bg-zinc-200/70 px-3 py-1.5 text-left text-sm text-zinc-600 ring-0 outline-none hover:bg-zinc-300/80 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-700"
									aria-label="输入评论"
								>
									<div
										class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-400 text-sm font-medium text-white"
									>
										U
									</div>
									<span class="truncate">Ciallo～</span>
								</Popover.PopoverTrigger>

								<Popover.PopoverContent class="w-80 p-3" side="top" align="start">
									<EditCommentPopover
										replyTo={commentReplyTo}
										onSubmit={handleSubmitComment}
										onCancel={() => {
											commentEditorOpen = false;
											commentReplyTo = null;
										}}
									/>
								</Popover.PopoverContent>
							</Popover.Popover>

							<div class="flex items-center gap-1">
								<Button
									variant="ghost"
									size="sm"
									disabled={isLiking}
									class={cn(
										'flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800',
										post.relation_status?.is_liked && 'text-rose-500'
									)}
									onclick={handleLike}
								>
									{#if isLiking}
										<LoaderCircle class="size-4 animate-spin" />
									{:else}
										<Heart class={cn('size-4', post.relation_status?.is_liked && 'fill-current')} />
									{/if}
									{#if post.stats?.like_count != null}
										<span>{post.stats.like_count}</span>
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									disabled={isCollecting}
									class={cn(
										'flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800',
										post.relation_status?.is_collected && 'text-amber-500'
									)}
									onclick={handleCollect}
								>
									{#if isCollecting}
										<LoaderCircle class="size-4 animate-spin" />
									{:else}
										<Star
											class={cn('size-4', post.relation_status?.is_collected && 'fill-current')}
										/>
									{/if}
									{#if post.stats?.collect_count != null}
										<span>{post.stats.collect_count}</span>
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									class="flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
									onclick={() => {
										scrollToComments();
										openCommentEditor(null);
									}}
								>
									<MessageCircle class="size-4" />
									{#if post.stats?.comment_count != null}
										<span>{post.stats.comment_count}</span>
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									class="flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full text-zinc-700 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
									onclick={handleShare}
								>
									<Share class="size-4" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- 局部错误提示（不影响整个弹窗） -->
{#if actionError}
	<AlertDialog.Root open={true} onOpenChange={(open) => !open && (actionError = null)}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>操作失败</AlertDialog.Title>
				<AlertDialog.Description>{actionError}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Action onclick={() => (actionError = null)}>知道了</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}

<!-- 成功提示通知 -->
{#if notification}
	<AlertDialog.Root open={true} onOpenChange={(open) => !open && (notification = null)}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>操作成功</AlertDialog.Title>
				<AlertDialog.Description>{notification}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Action onclick={() => (notification = null)}>好的</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}

<!-- 用户资料 Popover -->
{#if isUserProfilePopoverOpen && pendingUserProfileUserId}
	<UserProfilePopover
		userId={pendingUserProfileUserId}
		onClose={() => {
			isUserProfilePopoverOpen = false;
			pendingUserProfileUserId = null;
		}}
	/>
{/if}
