<script lang="ts">
	import type {
		V1Post as Post,
		V1Comment,
		V1CommentWithFirstReply,
		V1CreateCommentRequest,
		V1CommentTargetType
	} from '$lib/api';
	import {
		postServiceGetPost,
		postServiceSetPostLike,
		postServiceSetPostCollect,
		commentServiceCreateComment
	} from '$lib/api';
	import { formatTimeAgo } from '$lib/time';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import {
		X,
		Heart,
		MessageCircle,
		Star,
		Share,
		ChevronLeft,
		ChevronRight,
		Loader2,
		Play
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { resolve } from '$app/paths';
	import ImageVideoPreview from '$lib/components/custom/image-video-preview/image-video-preview.svelte';
	import CommentSection from '$lib/components/custom/comment-section/comment-section.svelte';
	import { EditCommentPopover } from '$lib/components/custom/edit-comment-popover';
	import { getMediaDisplayUrl } from '$lib/media-url';
	import { isMobileUA } from '$lib/utils/device';

	let {
		post: initialPost,
		postId,
		useMockComments = false,
		mockComments,
		onClose
	}: {
		/** 直接传入的帖子数据（可选，用于 mock 或已有数据） */
		post?: Post;
		/** 帖子 ID（可选，如果提供则从 API 获取） */
		postId?: string;
		/** 开发/联调：是否启用评论 mock（不影响帖子本身的获取方式） */
		useMockComments?: boolean;
		/** 开发/联调：直接注入评论 mock 数据（类型与 CommentSection 对齐） */
		mockComments?: V1CommentWithFirstReply[];
		/** 可选：点击关闭按钮/遮罩时的回调，由父组件控制是否卸载 Stack */
		onClose?: () => void;
	} = $props();

	let post = $state<Post | null>(initialPost ?? null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let isLiking = $state(false);
	let isCollecting = $state(false);

	// 通过 UA 判断是否为移动端设备（与预览组件保持一致）
	const isMobile = $derived.by(() => isMobileUA());

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

	async function fetchPost(id: string) {
		isLoading = true;
		error = null;
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
			error = '点赞操作失败，请重试';
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
			error = '收藏操作失败，请重试';
		} finally {
			isCollecting = false;
		}
	}

	const mediaList = $derived(post?.media ?? []);
	let activeIndex = $state(mediaList.length > 0 ? 0 : -1);
	// 图片视频预览编辑器状态
	let isPreviewEditorOpen = $state(false);
	let previewEditorInitialIndex = $state(0);
	let previewEditorAutoplay = $state(false);

	$effect(() => {
		// 关闭预览时重置自动播放标记，避免下次误触发
		if (!isPreviewEditorOpen) {
			previewEditorAutoplay = false;
		}
	});

	let swipeStartX: number | null = null;
	let swipeStartY: number | null = null;
	let swipeStartTime: number | null = null;
	let isSwiping = $state(false);

	const SWIPE_MIN_DISTANCE = 40;
	const SWIPE_MAX_TIME = 500;
	const TAP_MAX_MOVE = 6;
	const TAP_MAX_TIME = 250;

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

	function prevMedia() {
		if (mediaList.length <= 1 || activeIndex <= 0) return;
		activeIndex = activeIndex - 1;
	}

	function nextMedia() {
		if (mediaList.length <= 1 || activeIndex >= mediaList.length - 1) return;
		activeIndex = activeIndex + 1;
	}

	function startSwipe(x: number, y: number) {
		swipeStartX = x;
		swipeStartY = y;
		swipeStartTime = Date.now();
		isSwiping = false;
	}

	function endSwipe(x: number, y: number): boolean {
		if (swipeStartX === null || swipeStartY === null || swipeStartTime === null) {
			return false;
		}

		const deltaX = x - swipeStartX;
		const deltaY = y - swipeStartY;
		const deltaTime = Date.now() - swipeStartTime;

		// 判断是否是滑动：位移足够大且时间足够短
		const isSwipe =
			Math.abs(deltaX) >= SWIPE_MIN_DISTANCE || Math.abs(deltaY) >= SWIPE_MIN_DISTANCE;
		const isValidSwipe = isSwipe && deltaTime < SWIPE_MAX_TIME;

		// 仅在水平位移足够且明显大于垂直位移时触发「滑动切换」
		if (
			isValidSwipe &&
			Math.abs(deltaX) >= SWIPE_MIN_DISTANCE &&
			Math.abs(deltaX) > Math.abs(deltaY)
		) {
			isSwiping = true;
			if (deltaX > 0) {
				prevMedia();
			} else {
				nextMedia();
			}
		}

		const wasSwiping = isSwiping;
		swipeStartX = null;
		swipeStartY = null;
		swipeStartTime = null;
		isSwiping = false;

		return wasSwiping;
	}

	function handlePointerDown(event: PointerEvent | TouchEvent) {
		const touch = 'touches' in event ? event.touches[0] : event;
		startSwipe(touch.clientX, touch.clientY);
	}

	function handlePointerUp(event: PointerEvent | TouchEvent) {
		if (swipeStartX === null || swipeStartY === null) return;
		const touch = 'changedTouches' in event ? event.changedTouches[0] : event;

		const endX = touch.clientX;
		const endY = touch.clientY;
		const startX = swipeStartX;
		const startY = swipeStartY;
		const startTime = swipeStartTime ?? Date.now();

		const deltaX = endX - startX;
		const deltaY = endY - startY;
		const deltaTime = Date.now() - startTime;

		const wasSwiping = endSwipe(endX, endY);

		// 只有在真正的「轻点」场景（位移和时间都很小）才认为是点击，才打开预览。
		// 这样可以避免用户做轻微的横向滑动时被误判为点击，从而触发预览，影响外层 card 的滑动手势。
		const isTap =
			Math.abs(deltaX) <= TAP_MAX_MOVE &&
			Math.abs(deltaY) <= TAP_MAX_MOVE &&
			deltaTime <= TAP_MAX_TIME;

		// 如果不是滑动且是轻点，并且点击的是媒体区域，才打开预览
		if (!wasSwiping && isTap) {
			const target = event.target as HTMLElement;
			// 排除按钮和控制元素
			if (target.closest('button')) {
				return;
			}
			// 检查是否点击的是媒体元素（图片或视频容器）
			const mediaContainer = target.closest('[data-media-index]');
			if (mediaContainer) {
				const mediaIndex = parseInt(mediaContainer.getAttribute('data-media-index') || '-1');
				if (mediaIndex >= 0 && mediaIndex < mediaList.length) {
					openPreviewEditor(mediaIndex);
				}
			}
		}
	}

	function handlePointerLeave(event: PointerEvent) {
		if (swipeStartX === null || swipeStartY === null) return;
		endSwipe(event.clientX, event.clientY);
	}

	function openPreviewEditor(index: number, autoplay = false) {
		previewEditorInitialIndex = index;
		isPreviewEditorOpen = true;
		previewEditorAutoplay = autoplay;
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
				<Loader2 class="size-8 animate-spin text-zinc-500" />
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
				<!-- 媒体区（桌面端：仅在 UA 判定为非移动设备时展示左侧大预览） -->
				{#if !isMobile}
					<div
						class={cn(
							'group relative hidden shrink-0 items-center justify-center bg-black/80 lg:flex',
							'lg:w-1/2',
							'lg:h-auto'
						)}
						role="group"
						aria-roledescription="carousel"
						onpointerdown={handlePointerDown}
						onpointerup={handlePointerUp}
						onpointerleave={handlePointerLeave}
						ontouchstart={handlePointerDown}
						ontouchmove={handlePointerDown}
						ontouchend={handlePointerUp}
					>
						{#if mediaList.length > 0 && activeIndex >= 0}
							<!-- 媒体滑动视口 -->
							<div class="relative h-full w-full overflow-hidden">
								<div
									class="flex h-full w-full transition-transform duration-260 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
									style={`transform: translateX(-${activeIndex * 100}%);`}
								>
									{#each mediaList as media, index (media.object_key ?? index)}
										<div
											class="flex h-full w-full flex-[0_0_100%] items-center justify-center"
											data-media-index={index}
										>
											{#if media.type === 'MEDIA_TYPE_IMAGE'}
												<img
													src={getMediaDisplayUrl(media)}
													alt={post.title ?? ''}
													class="max-h-full max-w-full cursor-pointer object-contain"
												/>
											{:else}
												<!-- 视频预览：显示第一帧和播放按钮 -->
												<div
													class="relative flex h-full w-full cursor-pointer items-center justify-center"
												>
													<video
														src={getMediaDisplayUrl(media)}
														class="max-h-full max-w-full object-contain"
														preload="metadata"
														playsinline
														muted
													></video>
													<!-- 播放按钮覆盖层 -->
													<div
														class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20"
													>
														<Button
															variant="ghost"
															size="icon"
															class="pointer-events-auto min-h-16 min-w-16 rounded-full bg-black/50 text-white hover:bg-black/70"
															onclick={(e) => {
																e.stopPropagation();
																openPreviewEditor(index, true);
															}}
														>
															<Play class="size-8" />
														</Button>
													</div>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>

							<!-- 左右切换 -->
							{#if mediaList.length > 1}
								<button
									class="absolute top-1/2 left-3 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-zinc-100 opacity-0 transition group-hover:opacity-100 hover:bg-black/60"
									onclick={prevMedia}
									aria-label="上一张"
									type="button"
								>
									<ChevronLeft class="size-5" />
								</button>
								<button
									class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-zinc-100 opacity-0 transition group-hover:opacity-100 hover:bg-black/60"
									onclick={nextMedia}
									aria-label="下一张"
									type="button"
								>
									<ChevronRight class="size-5" />
								</button>

								<!-- 媒体分页圆点 + 热区 -->
								<div class="absolute bottom-3 left-1/2 -translate-x-1/2">
									<div
										class="flex cursor-pointer items-center gap-2 rounded-full bg-transparent px-3 py-1 transition-colors hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
									>
										{#each mediaList as media, index (media.object_key ?? index)}
											<button
												type="button"
												class={cn(
													'h-2 w-2 cursor-pointer rounded-full transition-colors',
													index === activeIndex
														? 'bg-rose-500'
														: 'bg-zinc-300/80 hover:bg-zinc-400 dark:bg-zinc-600/80 dark:hover:bg-zinc-500'
												)}
												onclick={() => (activeIndex = index)}
												aria-label={`查看第 ${index + 1} 张媒体`}
											></button>
										{/each}
									</div>
								</div>
							{/if}
						{:else}
							<div class="flex h-full w-full items-center justify-center text-sm text-zinc-300">
								暂无媒体内容
							</div>
						{/if}
					</div>
				{/if}

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
							<!-- 之后需要替换为用户的个人主页 -->
							<a href={resolve('/app/home')}>
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

							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<p class="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
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
								<Button variant="default" class="text-md min-w-20 font-bold">关注</Button>
							</div>
						</div>
					</div>
					<div class="scrollbar-hide flex-1 overflow-y-auto px-4 pb-4 lg:px-6 lg:pb-4">
						<!-- 媒体区（移动端单独展示，位于中间区域，并占满头部与底部之间空间的绝大部分） -->
						{#if isMobile}
							<div
								class={cn(
									'mb-4 lg:hidden',
									'group relative flex items-center justify-center bg-black/80',
									'h-[60vh]'
								)}
								role="group"
								aria-roledescription="carousel"
								onpointerdown={handlePointerDown}
								onpointerup={handlePointerUp}
								onpointerleave={handlePointerLeave}
								ontouchstart={handlePointerDown}
								ontouchmove={handlePointerDown}
								ontouchend={handlePointerUp}
							>
								{#if mediaList.length > 0 && activeIndex >= 0}
									<!-- 媒体滑动视口 -->
									<div class="relative h-full w-full overflow-hidden">
										<div
											class="flex h-full w-full transition-transform duration-260 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
											style={`transform: translateX(-${activeIndex * 100}%);`}
										>
											{#each mediaList as media, index (media.object_key ?? index)}
												<div
													class="flex h-full w-full flex-[0_0_100%] items-center justify-center"
													data-media-index={index}
												>
													{#if media.type === 'MEDIA_TYPE_IMAGE'}
														<img
															src={getMediaDisplayUrl(media)}
															alt={post.title ?? ''}
															class="max-h-full max-w-full cursor-pointer object-contain"
														/>
													{:else}
														<!-- 视频预览：显示第一帧和播放按钮 -->
														<div
															class="relative flex h-full w-full cursor-pointer items-center justify-center"
														>
															<video
																src={getMediaDisplayUrl(media)}
																class="max-h-full max-w-full object-contain"
																preload="metadata"
																playsinline
																muted
															></video>
															<!-- 播放按钮覆盖层 -->
															<div
																class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20"
															>
																<Button
																	variant="ghost"
																	size="icon"
																	class="pointer-events-auto min-h-16 min-w-16 rounded-full bg-black/50 text-white hover:bg-black/70"
																	onclick={(e) => {
																		e.stopPropagation();
																		openPreviewEditor(index, true);
																	}}
																>
																	<Play class="size-8" />
																</Button>
															</div>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</div>

									<!-- 左右切换 -->
									{#if mediaList.length > 1}
										<button
											class="absolute top-1/2 left-3 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-zinc-100 opacity-0 transition group-hover:opacity-100 hover:bg-black/60"
											onclick={prevMedia}
											aria-label="上一张"
											type="button"
										>
											<ChevronLeft class="size-5" />
										</button>
										<button
											class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-full bg-black/40 p-2 text-zinc-100 opacity-0 transition group-hover:opacity-100 hover:bg-black/60"
											onclick={nextMedia}
											aria-label="下一张"
											type="button"
										>
											<ChevronRight class="size-5" />
										</button>

										<!-- 媒体分页圆点 + 热区 -->
										<div class="absolute bottom-3 left-1/2 -translate-x-1/2">
											<div
												class="flex cursor-pointer items-center gap-2 rounded-full bg-transparent px-3 py-1 transition-colors hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
											>
												{#each mediaList as media, index (media.object_key ?? index)}
													<button
														type="button"
														class={cn(
															'h-2 w-2 cursor-pointer rounded-full transition-colors',
															index === activeIndex
																? 'bg-rose-500'
																: 'bg-zinc-300/80 hover:bg-zinc-400 dark:bg-zinc-600/80 dark:hover:bg-zinc-500'
														)}
														onclick={() => (activeIndex = index)}
														aria-label={`查看第 ${index + 1} 张媒体`}
													></button>
												{/each}
											</div>
										</div>
									{/if}
								{:else}
									<div class="flex h-full w-full items-center justify-center text-sm text-zinc-300">
										暂无媒体内容
									</div>
								{/if}
							</div>
						{/if}
						<!-- 标题与正文 -->
						<div class="mt-4 space-y-3">
							{#if post.title}
								<h1 class="text-base leading-snug font-semibold text-zinc-900 dark:text-zinc-50">
									{post.title}
								</h1>
							{/if}

							{#if rawContent}
								<div class="space-y-1">
									<p
										class="text-sm leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-200"
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
								<p class="mt-1 text-xs text-zinc-500">
									{#if publishLabel}{publishLabel}{/if}
								</p>
							{/if}
						</div>

						<!-- 评论区 -->
						<div class="mt-6" bind:this={commentSectionEl}>
							{#if post.post_id}
								<CommentSection
									bind:this={commentSectionRef}
									postId={post.post_id}
									initialCount={post.stats?.comment_count}
									useMock={useMockComments}
									{mockComments}
									onReply={openCommentEditor}
									onTotalCountChange={handleCommentCountChange}
								/>
							{/if}
						</div>
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

								<Popover.PopoverContent class="w-80 p-3">
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
										<Loader2 class="size-4 animate-spin" />
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
										<Loader2 class="size-4 animate-spin" />
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

<!-- 图片视频预览-->
<ImageVideoPreview
	bind:open={isPreviewEditorOpen}
	{mediaList}
	initialIndex={previewEditorInitialIndex}
	autoplay={previewEditorAutoplay}
	fullScreen={true}
/>
