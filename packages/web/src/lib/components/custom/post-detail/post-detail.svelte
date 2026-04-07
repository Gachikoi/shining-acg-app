<script lang="ts">
	/**
	 * @component PostDetail — 帖子详情（弹层/全屏）
	 *
	 * **数据入口**（二选一）：传入 `post` 直接渲染；或传 `postId` 由 `api.getPost` 拉取。业务默认使用 `createRealPostDetailApi`；调试页可注入 `createMockPostDetailApi`（见 `routes/.../post-detail-debug`）。
	 *
	 * **子模块**
	 * - `post-media-area.svelte`：帖内多图/视频轮播，并内嵌 `ImageVideoPreview` 做全屏预览
	 * - `CommentSection`：一级评论列表、排序、回复、举报/删除
	 * - `EditCommentPopover`：发评/回复输入与图片草稿
	 *
	 * **共享工具**：相对时间 `$lib/utils/format-time.formatTimeAgo`；媒体地址 `$lib/utils/media-url.getMediaDisplayUrl`（与预览组件一致）。
	 *
	 * ### 功能特性
	 *
	 * - **媒体**：侧栏或顶部轮播，手势切图；点媒体进入 `ImageVideoPreview`
	 * - **作者**：头像、昵称、部门/认证、关注（四种关系文案，数据来自 `api.getUser`）
	 * - **正文**：标题 + 正文，超长折叠（约 1000 字「查看全文」）
	 * - **互动**：点赞、收藏、评论入口、分享；评论走 `api` 与上传封装 `createMediaUploader`
	 * - **布局**：宽屏左右分栏，窄屏上下堆叠
	 *
	 * ### Props 摘要
	 *
	 * | 属性 | 说明 |
	 * |------|------|
	 * | `post` | 已有 `V1Post` 时免请求 |
	 * | `postId` | 与 `post` 互斥；会触发加载态与错误展示 |
	 * | `showComments` | 是否挂载评论区 |
	 * | `api` | `PostDetailApi` 实现，便于 Mock/E2E |
	 * | `onClose` | 关闭按钮、遮罩、ESC；是否卸载由父级决定 |
	 */

	import { resolve } from '$app/paths';
	import type {
		V1Post as Post,
		V1Comment,
		V1CommentTargetType,
		V1CreateCommentRequest,
		V1MediaAsset
	} from '$lib/api';
	import CommentSection from '$lib/components/custom/comment-section/comment-section.svelte';
	import { EditCommentPopover } from '$lib/components/custom/edit-comment-popover';
	import PostMediaArea from '$lib/components/custom/post-detail/post-media-area.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { tap } from '$lib/modules/gesture';
	import { buildPrepareUploadParams, createMediaUploader } from '$lib/modules/media-uploader';
	import { cn } from '$lib/utils';
	import { formatTimeAgo } from '$lib/utils/format-time';
	import { messageForOperationError } from '$lib/utils/operation-error-message';
	import { Heart, LoaderCircle, MessageCircle, Share, Star, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { fly } from 'svelte/transition';
	import { createRealPostDetailApi, type PostDetailApi, type UserFollowStatus } from './api';
	const defaultApi = createRealPostDetailApi({
		uploadCommentMedia: (files) => uploadCommentMedia(files)
	});

	/** 点赞/收藏 zoom 动画最短展示时间，与评论区一致 */
	const LIKE_FEEDBACK_MIN_MS = 420;

	let {
		post: initialPost,
		postId,
		showComments = true,
		api = defaultApi,
		onClose
	}: {
		/** 直接传入的帖子数据（可选，用于已有数据直出渲染） */
		post?: Post;
		/** 帖子 ID（可选，如果提供则从 API 获取） */
		postId?: string;
		/** 是否展示评论区 */
		showComments?: boolean;
		/** API 适配层，默认走真实后端；传入 mock 实现可脱离后端调试 */
		api?: PostDetailApi;
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
	let currentUserAvatar = $state<string | null>(null);
	let currentUserName = $state<string | null>(null);
	let followStatus = $state<UserFollowStatus>({ isFollowing: false, isFollowedBy: false });

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
				const res = await api.getMe();
				if (res.userId) {
					currentUserId = res.userId;
					currentUserAvatar = res.avatar?.trim() ? res.avatar : null;
					currentUserName = res.name?.trim() ? res.name : null;
				}
			} catch (err) {
				console.error('获取当前用户信息失败:', err);
			}
		}
		fetchCurrentUser();
	});

	// 通过 userServiceGetUser 获取作者的关注状态
	$effect(() => {
		async function fetchFollowingStatus() {
			if (!post?.author?.userId || !currentUserId || post.author.userId === currentUserId) {
				followStatus = { isFollowing: false, isFollowedBy: false };
				return;
			}

			isFetchingFollowing = true;
			try {
				followStatus = await api.getUser(post.author.userId);
			} catch (err) {
				console.error('获取关注状态失败:', err);
				followStatus = { isFollowing: false, isFollowedBy: false };
			} finally {
				isFetchingFollowing = false;
			}
		}
		fetchFollowingStatus();
	});

	async function fetchPost(id: string) {
		isLoading = true;
		error = null;
		try {
			const res = await api.getPost(id);
			if (res.post) {
				post = res.post;
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
		if (!post?.postId || isLiking) return;

		const currentIsLiked = post.relationStatus?.isLiked ?? false;
		const newIsLiked = !currentIsLiked;

		if (post.stats) {
			const currentCount = Number(post.stats.likeCount ?? '0') || 0;
			post.stats.likeCount = String(currentCount + (newIsLiked ? 1 : -1));
		}
		if (post.relationStatus) {
			post.relationStatus.isLiked = newIsLiked;
		}

		isLiking = true;
		const t0 = Date.now();
		try {
			await api.setPostLike(post.postId, newIsLiked);
		} catch (err) {
			console.error('点赞操作失败:', err);
			const wait = Math.max(0, LIKE_FEEDBACK_MIN_MS - (Date.now() - t0));
			await new Promise((r) => setTimeout(r, wait));
			if (post.stats) {
				const currentCount = Number(post.stats.likeCount ?? '0') || 0;
				post.stats.likeCount = String(currentCount + (newIsLiked ? -1 : 1));
			}
			if (post.relationStatus) {
				post.relationStatus.isLiked = currentIsLiked;
			}
			toast.error(messageForOperationError(err, '点赞失败，请重试'));
		} finally {
			const wait = Math.max(0, LIKE_FEEDBACK_MIN_MS - (Date.now() - t0));
			await new Promise((r) => setTimeout(r, wait));
			isLiking = false;
		}
	}

	async function handleCollect() {
		if (!post?.postId || isCollecting) return;

		const currentIsCollected = post.relationStatus?.isCollected ?? false;
		const newIsCollected = !currentIsCollected;

		if (post.stats) {
			const currentCount = Number(post.stats.collectCount ?? '0') || 0;
			post.stats.collectCount = String(currentCount + (newIsCollected ? 1 : -1));
		}
		if (post.relationStatus) {
			post.relationStatus.isCollected = newIsCollected;
		}

		isCollecting = true;
		const t0 = Date.now();
		try {
			await api.setPostCollect(post.postId, newIsCollected);
		} catch (err) {
			console.error('收藏操作失败:', err);
			const wait = Math.max(0, LIKE_FEEDBACK_MIN_MS - (Date.now() - t0));
			await new Promise((r) => setTimeout(r, wait));
			if (post.stats) {
				const currentCount = Number(post.stats.collectCount ?? '0') || 0;
				post.stats.collectCount = String(currentCount + (newIsCollected ? -1 : 1));
			}
			if (post.relationStatus) {
				post.relationStatus.isCollected = currentIsCollected;
			}
			toast.error(messageForOperationError(err, '收藏失败，请重试'));
		} finally {
			const wait = Math.max(0, LIKE_FEEDBACK_MIN_MS - (Date.now() - t0));
			await new Promise((r) => setTimeout(r, wait));
			isCollecting = false;
		}
	}

	/**
	 * 根据双向关注关系推导按钮文案：
	 * - 未关注 + 未被关注 → "关注"
	 * - 未关注 + 被关注   → "回关"
	 * - 已关注 + 被关注   → "互相关注"
	 * - 已关注 + 未被关注 → "已关注"
	 */
	const followButtonLabel = $derived.by(() => {
		if (followStatus.isFollowing && followStatus.isFollowedBy) return '互相关注';
		if (followStatus.isFollowing) return '已关注';
		if (followStatus.isFollowedBy) return '回关';
		return '关注';
	});

	async function handleFollow() {
		if (!currentUserId) {
			toast.error('请先登录后再关注');
			return;
		}

		if (!post?.author?.userId || isFollowingAction) return;

		const prevStatus = { ...followStatus };
		const newIsFollowing = !followStatus.isFollowing;

		// 乐观更新
		followStatus = { ...followStatus, isFollowing: newIsFollowing };

		isFollowingAction = true;
		try {
			await api.setFollow(post.author.userId, newIsFollowing);
		} catch (err) {
			console.error('关注操作失败:', err);
			followStatus = prevStatus;
			toast.error(messageForOperationError(err, '关注失败，请重试'));
		} finally {
			isFollowingAction = false;
		}
	}

	async function handleShare() {
		if (!post) return;

		try {
			const postTitle = post.title || '帖子';
			const postUrl = `${window.location.origin}${resolve('/app/home')}?postId=${post.postId}`;
			const shareText = `【${postTitle}】${postUrl}`;

			// 使用 Clipboard API
			await navigator.clipboard.writeText(shareText);

			toast.success('已复制链接到剪贴板');
		} catch (err) {
			console.error('分享失败:', err);
			toast.error(messageForOperationError(err, '转发失败，请重试'));
		}
	}

	const author = $derived(post?.author);
	const departments = $derived(author?.departments ?? []);
	const publishLabel = $derived(formatTimeAgo(post?.publishTime ?? ''));

	const CONTENT_LIMIT = 1000;

	function flattenPostContent(units: Post['content'] | undefined): string {
		if (!units?.length) return '';
		let out = '';
		for (const u of units) {
			if (u.type === 'text') out += u.content;
			else out += `@${u.name}`;
		}
		return out;
	}

	const rawContent = $derived(flattenPostContent(post?.content));
	const hasLongContent = $derived(rawContent.length > CONTENT_LIMIT);
	let isContentExpanded = $state(false);

	type CommentSectionHandle = {
		applyNewComment: (comment: V1Comment) => void | Promise<void>;
	};

	let commentSectionRef = $state<CommentSectionHandle | null>(null);
	let commentSectionEl = $state<HTMLElement | null>(null);
	/** 右侧正文区滚动容器：用于「未在顶部」时在头像区底边显示分割线 */
	let mainScrollEl = $state<HTMLDivElement | null>(null);
	let isHeaderDividerVisible = $state(false);
	let commentEditorOpen = $state(false);
	let commentReplyTo = $state<V1Comment | null>(null);
	let commentEditorKeyboardInset = $state(0);
	let commentEditorPanelEl = $state<HTMLElement | null>(null);
	let commentEditorTriggerEl = $state<HTMLElement | null>(null);
	const commentMediaUploader = createMediaUploader();

	function getDisplayedContent() {
		if (!hasLongContent || isContentExpanded) return rawContent;
		return rawContent.slice(0, CONTENT_LIMIT) + '…';
	}

	function handleClose() {
		onClose?.();
	}

	/**
	 * 头像加载失败：隐藏 img，仅显示外层圆形容器背景（不使用 alt 文案占位）。
	 *
	 * @param e - img error 事件
	 */
	function onAvatarImageError(e: Event) {
		const el = e.currentTarget;
		if (el instanceof HTMLImageElement) el.style.display = 'none';
	}

	function scrollToComments() {
		if (commentSectionEl) {
			commentSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	function syncHeaderDividerFromScroll() {
		const el = mainScrollEl;
		isHeaderDividerVisible = !!el && el.scrollTop > 1;
	}

	let lastScrollResetPostId = $state<string | undefined>(undefined);
	$effect(() => {
		const id = post?.postId;
		const el = mainScrollEl;
		if (!id || !el) return;
		if (lastScrollResetPostId !== id) {
			lastScrollResetPostId = id;
			el.scrollTop = 0;
			syncHeaderDividerFromScroll();
		}
	});

	function openCommentEditor(target: V1Comment | null = null) {
		commentReplyTo = target;
		commentEditorOpen = true;
	}

	function closeCommentEditor() {
		commentEditorOpen = false;
		commentReplyTo = null;
	}

	function handleContentAreaPointerDown(event: PointerEvent) {
		if (!commentEditorOpen) return;
		const target = event.target as Node | null;
		if (!target) return;
		if (commentEditorPanelEl?.contains(target)) return;
		if (commentEditorTriggerEl?.contains(target)) return;
		closeCommentEditor();
	}

	function handleCommentCountChange(delta: number) {
		if (!post?.stats) return;
		const raw = post.stats.commentCount;
		const current = Number(raw ?? '0') || 0;
		const next = Math.max(0, current + delta);
		post.stats.commentCount = String(next);
	}

	$effect(() => {
		return () => {
			commentMediaUploader.destroy();
		};
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const visualViewport = window.visualViewport;
		if (!visualViewport) return;

		const updateKeyboardInset = () => {
			if (!commentEditorOpen) {
				commentEditorKeyboardInset = 0;
				return;
			}
			const inset = Math.max(
				0,
				window.innerHeight - (visualViewport.height + visualViewport.offsetTop)
			);
			commentEditorKeyboardInset = inset;
		};

		updateKeyboardInset();
		visualViewport.addEventListener('resize', updateKeyboardInset);
		visualViewport.addEventListener('scroll', updateKeyboardInset);
		window.addEventListener('resize', updateKeyboardInset);

		return () => {
			visualViewport.removeEventListener('resize', updateKeyboardInset);
			visualViewport.removeEventListener('scroll', updateKeyboardInset);
			window.removeEventListener('resize', updateKeyboardInset);
		};
	});

	async function uploadCommentMedia(mediaFiles: File[]): Promise<V1MediaAsset[]> {
		if (mediaFiles.length === 0) return [];

		try {
			const params = buildPrepareUploadParams({
				scene: 'MEDIA_SCENE_COMMENT_MEDIA',
				files: mediaFiles
			});
			const batchId = await commentMediaUploader.upload(params);
			const uploadResult = await commentMediaUploader.uppy.upload();
			if (uploadResult?.failed && uploadResult.failed.length > 0) {
				throw uploadResult.failed[0].error ?? new Error('评论图片上传失败');
			}
			return await commentMediaUploader.getBatchMedia(batchId);
		} finally {
			commentMediaUploader.clear();
		}
	}

	async function handleSubmitComment(
		content: string,
		replyTo: V1Comment | null,
		mediaFiles: File[]
	) {
		if (!post?.postId) return;

		const normalizedContent = content.trim();
		if (!normalizedContent && mediaFiles.length === 0) return;

		const uploadedMedia = await api.uploadCommentMedia(mediaFiles);

		const body: V1CreateCommentRequest = {
			targetId: post.postId,
			targetType: 'COMMENT_TARGET_TYPE_POST' as V1CommentTargetType,
			content: normalizedContent,
			media: uploadedMedia
		};

		if (replyTo && replyTo.commentId) {
			const parentId = replyTo.replyContext?.parentCommentId ?? replyTo.commentId;
			body.replyContext = {
				parentCommentId: parentId,
				replyToCommentId: replyTo.commentId,
				replyToUserId: replyTo.author?.userId,
				replyToUserName: replyTo.author?.name
			};
		}

		try {
			const res = await api.createComment(body);
			if (res.comment) {
				await commentSectionRef?.applyNewComment(res.comment);
				toast.success('评论已发布');
				commentEditorOpen = false;
				commentReplyTo = null;
			}
		} catch (err) {
			console.error('发布评论失败', err);
			toast.error(messageForOperationError(err, '发布评论失败，请重试'));
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
				'flex items-stretch justify-center'
			)}
		>
			<div
				class={cn(
					'max-w-10xl flex h-full w-full flex-col items-center justify-center bg-zinc-100 text-zinc-900',
					'lg:max-h-[calc(100vh-3rem)] lg:rounded-2xl',
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
		use:tap={{
			onTap: ({ target, currentTarget }) => {
				if (target === currentTarget) handleClose();
			}
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
				'flex items-stretch justify-center'
			)}
		>
			<div
				class={cn(
					'max-w-10xl flex h-full w-full flex-col items-center justify-center bg-zinc-100 px-6 text-zinc-900',
					'lg:max-h-[calc(100vh-3rem)] lg:rounded-2xl',
					'dark:bg-zinc-900 dark:text-zinc-50',
					'rounded-none shadow-xl'
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
		use:tap={{
			onTap: ({ target, currentTarget }) => {
				// 仅点击遮罩时关闭，避免内容点击误触
				if (target === currentTarget) handleClose();
			}
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
				<div class={cn('hidden min-h-0 min-w-0 shrink-0 lg:flex lg:h-auto lg:w-1/2')}>
					<PostMediaArea mediaList={post.media ?? []} postTitle={post.title ?? ''} />
				</div>

				<!-- 文本与操作区：头部 + 中间滚动区（含移动端媒体区）+ 底部操作栏 -->
				<div
					class="relative flex h-full grow flex-col lg:w-1/2"
					onpointerdown={handleContentAreaPointerDown}
				>
					<!-- 作者信息与统计：正文区向下滚动后显示底部分割线，与下方媒体/正文区分 -->
					<div
						class={cn(
							'flex-none px-4 pt-4 pb-4 transition-colors lg:px-6 lg:pt-6 lg:pb-4',
							isHeaderDividerVisible && 'border-b border-zinc-200/95 dark:border-zinc-700/90'
						)}
					>
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
							{#if author?.userId && currentUserId && author.userId === currentUserId}
								<a href={resolve('/app/profile')} class="cursor-pointer">
									{#if author?.avatar}
										<div
											class="size-11 shrink-0 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-600"
										>
											<img
												src={author.avatar}
												alt=""
												role="presentation"
												class="size-11 rounded-full object-cover"
												onerror={onAvatarImageError}
											/>
										</div>
									{:else}
										<div
											class="flex size-11 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
										>
											{author?.name?.slice(0, 1) ?? 'U'}
										</div>
									{/if}
								</a>
							{:else}
								<div class="shrink-0" role="presentation">
									{#if author?.avatar}
										<div
											class="size-11 shrink-0 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-600"
										>
											<img
												src={author.avatar}
												alt=""
												role="presentation"
												class="size-11 rounded-full object-cover"
												onerror={onAvatarImageError}
											/>
										</div>
									{:else}
										<div
											class="flex size-11 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100"
										>
											{author?.name?.slice(0, 1) ?? 'U'}
										</div>
									{/if}
								</div>
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
									{#if author?.verifiedTitle}
										<Badge
											variant="secondary"
											class="max-w-32 truncate bg-amber-50 text-xs font-normal text-amber-700"
										>
											{author.verifiedTitle}
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
								<div class="flex items-center gap-1">
									{#if post.author?.userId && post.author.userId !== currentUserId}
										<Button
											variant="default"
											class="text-md min-w-20 cursor-pointer font-bold"
											disabled={isFollowingAction || isFetchingFollowing}
											onclick={handleFollow}
										>
											{#if isFollowingAction || isFetchingFollowing}
												<LoaderCircle class="mr-1 size-4 animate-spin" />
											{/if}
											{followButtonLabel}
										</Button>
									{:else if !currentUserId}
										<!-- 未登录用户显示关注按钮，点击引导登录 -->
										<Button
											variant="default"
											class="text-md min-w-20 font-bold"
											onclick={() => {
												toast.error('请先登录后再关注');
											}}
										>
											关注
										</Button>
									{/if}
								</div>
							</div>
						</div>
					</div>
					<div
						bind:this={mainScrollEl}
						class="scrollbar-hide flex-1 overflow-y-auto px-4 pb-4 lg:px-6 lg:pb-4"
						onscroll={syncHeaderDividerFromScroll}
					>
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
								{#if post.postId}
									<CommentSection
										bind:this={commentSectionRef}
										postId={post.postId}
										{currentUserId}
										{api}
										initialCount={post.stats?.commentCount}
										onReply={openCommentEditor}
										onTotalCountChange={handleCommentCountChange}
									/>
								{/if}
							</div>
						{/if}
					</div>

					<!-- 底部操作栏：左侧约 1/3 为评论入口，右侧约 2/3 为赞/藏/评/转（转发最右） -->
					<div class="relative flex-none border-t border-zinc-200 dark:border-zinc-800">
						<div class="flex min-h-11 items-stretch gap-1 px-4 py-2 lg:gap-1.5 lg:px-6">
							<button
								bind:this={commentEditorTriggerEl}
								type="button"
								class="flex min-h-11 min-w-0 flex-1 basis-0 items-center gap-1.5 rounded-full bg-zinc-200/70 px-2.5 py-1.5 text-left text-sm text-zinc-600 ring-0 outline-none hover:bg-zinc-300/80 sm:gap-2 sm:px-3 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-700"
								aria-label="输入评论"
								onclick={() => openCommentEditor(commentReplyTo)}
							>
								{#if currentUserAvatar}
									<div
										class="size-8 shrink-0 overflow-hidden rounded-full bg-zinc-400 dark:bg-zinc-600"
									>
										<img
											src={currentUserAvatar}
											alt=""
											role="presentation"
											class="size-8 rounded-full object-cover"
											onerror={onAvatarImageError}
										/>
									</div>
								{:else}
									<div
										class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-400 text-sm font-medium text-white"
									>
										{(currentUserName ?? 'U').slice(0, 1)}
									</div>
								{/if}
								<span class="min-w-0 truncate">
									{commentReplyTo ? `回复 @${commentReplyTo.author?.name ?? '用户'}` : 'Ciallo～'}
								</span>
							</button>

							<div
								class="scrollbar-hide flex min-h-11 min-w-0 flex-[2] basis-0 items-center justify-end gap-0.5 overflow-x-auto lg:gap-1"
							>
								<Button
									variant="ghost"
									size="sm"
									disabled={isLiking}
									class={cn(
										'flex min-h-11 min-w-10 cursor-pointer items-center gap-0.5 rounded-full px-1.5 sm:min-w-11 sm:gap-1',
										post.relationStatus?.isLiked
											? '!text-rose-500 hover:!bg-rose-500/12 hover:!text-rose-500'
											: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
									)}
									onclick={handleLike}
								>
									{#key `${isLiking ? 'go' : 'idle'}`}
										<Heart
											class={cn(
												'size-4 origin-center',
												isLiking &&
													'animate-in duration-300 ease-out fill-mode-forwards zoom-in-75',
												post.relationStatus?.isLiked && 'fill-current !text-rose-500'
											)}
											fill={post.relationStatus?.isLiked ? 'currentColor' : 'none'}
										/>
									{/key}
									{#if post.stats?.likeCount != null}
										<span>{post.stats.likeCount}</span>
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									disabled={isCollecting}
									class={cn(
										'flex min-h-11 min-w-10 cursor-pointer items-center gap-0.5 rounded-full px-1.5 sm:min-w-11 sm:gap-1',
										post.relationStatus?.isCollected
											? '!text-amber-400 hover:!bg-amber-400/12 hover:!text-amber-400'
											: 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
									)}
									onclick={handleCollect}
								>
									{#key `${isCollecting ? 'go' : 'idle'}`}
										<Star
											class={cn(
												'size-4 origin-center',
												isCollecting &&
													'animate-in duration-300 ease-out fill-mode-forwards zoom-in-75',
												post.relationStatus?.isCollected && 'fill-current !text-amber-400'
											)}
											fill={post.relationStatus?.isCollected ? 'currentColor' : 'none'}
										/>
									{/key}
									{#if post.stats?.collectCount != null}
										<span>{post.stats.collectCount}</span>
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									class="flex min-h-11 min-w-10 cursor-pointer items-center gap-0.5 rounded-full px-1.5 text-zinc-700 hover:bg-zinc-100 sm:min-w-11 sm:gap-1 dark:text-zinc-100 dark:hover:bg-zinc-800"
									onclick={() => {
										scrollToComments();
										openCommentEditor(null);
									}}
								>
									<MessageCircle class="size-4" />
									{#if post.stats?.commentCount != null}
										<span>{post.stats.commentCount}</span>
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									class="flex min-h-11 min-w-10 shrink-0 cursor-pointer items-center gap-0.5 rounded-full px-1.5 text-zinc-700 hover:bg-zinc-100 sm:min-w-11 sm:gap-1 dark:text-zinc-100 dark:hover:bg-zinc-800"
									onclick={handleShare}
								>
									<Share class="size-4 shrink-0" />
								</Button>
							</div>
						</div>

						{#if commentEditorOpen}
							<div
								bind:this={commentEditorPanelEl}
								class="absolute inset-x-0 z-40"
								style={`bottom: ${commentEditorKeyboardInset}px;`}
								in:fly={{ y: 220, duration: 140 }}
								out:fly={{ y: 220, duration: 110 }}
							>
								<div
									class="w-full border-t border-zinc-200 bg-zinc-50 p-3 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
								>
									<EditCommentPopover
										postId={post.postId ?? null}
										replyTo={commentReplyTo}
										onSubmit={handleSubmitComment}
										onCancel={closeCommentEditor}
									/>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
