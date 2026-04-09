<script lang="ts">
	/**
	 * @component
	 * ## CommentSection - 评论区组件
	 *
	 * 帖子详情页内的评论区组件，负责评论的展示、排序、加载、回复、点赞、删除等交互。
	 * 使用 `commentServiceListPostComments` 接口获取评论数据。
	 *
	 * ### 功能特性
	 *
	 * - **评论展示**：展示一级评论及其回复，支持嵌套结构
	 * - **排序切换**：支持「最热」和「最新」两种排序方式
	 * - **分页加载**：支持游标分页加载更多评论和回复
	 * - **回复功能**：点击评论/回复可打开回复编辑器
	 * - **点赞功能**：支持对评论和回复点赞，采用乐观更新
	 * - **长内容折叠**：超过1000字的内容显示「查看全文」
	 * - **删除/举报**：支持删除自己的评论，举报不当评论
	 * - **Mock 模式**：开发/联调时可注入 mock 数据
	 *
	 * ### 使用方式
	 *
	 * ```svelte
	 * <CommentSection
	 *   postId="xxx"
	 *   initialCount={100}
	 *   defaultOrder="COMMENT_ORDER_TYPE_MOST_LIKED"
	 *   onReply={(comment) => { /* 打开回复编辑器 *\/ }}
	 *   onTotalCountChange={(delta) => { /* 更新总数 *\/ }}
	 * />
	 * ```
	 *
	 * ### Props
	 *
	 * | 属性 | 类型 | 默认值 | 说明 |
	 * |------|------|--------|------|
	 * | postId | string | - | 必填，帖子 ID |
	 * | initialCount | string \| number | - | 初始评论数（来自帖子统计） |
	 * | defaultOrder | V1CommentOrderType | COMMENT_ORDER_TYPE_MOST_LIKED | 默认排序方式 |
	 * | useMock | boolean | false | 开发/联调：是否启用 mock |
	 * | mockComments | V1CommentWithReplies[] | - | 开发/联调：mock 数据 |
	 * | onReply | (comment: V1Comment) => void | - | 点击回复按钮时的回调 |
	 * | onTotalCountChange | (delta: number) => void | - | 评论数变化时的回调 |
	 *
	 * ### 内部数据结构
	 *
	 * 组件内部将 `V1CommentWithReplies` 扁平化为 `CommentWithReplies`，添加以下内部字段：
	 * - `_replies`: 已加载的回复列表
	 * - `_repliesCursor`: 继续加载回复的游标
	 * - `_repliesLoading`: 回复加载中状态
	 * - `_repliesExpanded`: 展开/收起状态
	 */
	import type {
		V1Comment,
		V1CommentWithReplies,
		V1CommentOrderType,
		V1MediaAsset,
		V1ReportCommentRequest
	} from '$lib/api';
	import type { PostDetailApi } from '$lib/components/custom/post-detail/api';
	import { tick } from 'svelte';
	import { Heart, MessageCircle, MoreHorizontal } from 'lucide-svelte';
	import { formatTimeAgo } from '$lib/utils/format-time';
	import { getMediaDisplayUrl } from '$lib/utils/media-url';
	import { cn } from '$lib/utils';
	import ConfirmDialog from '$lib/components/custom/confirm-dialog/confirm-dialog.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { ImageVideoPreview } from '$lib/components/custom/image-video-preview';
	import { messageForOperationError } from '$lib/utils/operation-error-message';
	import { toast } from 'svelte-sonner';

	/** 评论区作者昵称、被回复者昵称统一浅灰 */
	const commentNameClass = 'font-medium text-zinc-400';
	const commentRowFocusClass =
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 dark:focus-visible:ring-zinc-500/60';

	let {
		postId,
		currentUserId,
		initialCount,
		api,
		defaultOrder = 'COMMENT_ORDER_TYPE_MOST_LIKED' as V1CommentOrderType,
		onReply,
		onTotalCountChange
	}: {
		postId: string;
		currentUserId?: string | null;
		initialCount?: string | number;
		api: PostDetailApi;
		defaultOrder?: V1CommentOrderType;
		onReply?: (comment: V1Comment) => void;
		onTotalCountChange?: (delta: number) => void;
	} = $props();

	/**
	 * 组件内部使用的评论结构：
	 * - 从接口 `V1CommentWithReplies` 扁平化为单条 `V1Comment`
	 * - 通过 `_replies`/_repliesCursor 等内部字段管理「仅展示一条最热回复 + 展开剩余回复」的 UI 逻辑
	 *
	 * 注意：不修改接口定义本身，只在前端做结构转换。
	 */
	type CommentWithReplies = V1Comment & {
		/**
		 * 当前已加载的回复列表（来自接口 replies 或后续分页获取的回复）
		 */
		_replies?: V1Comment[];
		/**
		 * 用于继续通过 `ListCommentReplies` 拉取更多回复的游标
		 */
		_repliesCursor?: string;
		_repliesLoading?: boolean;
		/**
		 * 是否已经展开全部回复；未展开时仅展示一条
		 */
		_repliesExpanded?: boolean;
	};

	let orderType = $state<V1CommentOrderType>((() => defaultOrder)());
	let comments = $state<CommentWithReplies[]>([]);
	let cursor = $state<string | undefined>(undefined);
	let loading = $state(false);
	let loadingMore = $state(false);
	let activeCommentRowId = $state<string | null>(null);
	let scrollY = $state(0);
	let windowInnerHeight = $state(0);
	let lastAutoLoadMoreAt = 0;
	let deleteConfirmOpen = $state(false);
	let reportConfirmOpen = $state(false);
	let commentToDelete = $state<V1Comment | CommentWithReplies | null>(null);
	let commentToReport = $state<V1Comment | CommentWithReplies | null>(null);
	let totalCount = $state<number>(
		(() => (typeof initialCount === 'string' ? Number(initialCount) || 0 : (initialCount ?? 0)))()
	);

	/** 防止切换排序时，较慢的旧请求覆盖较新的列表结果 */
	let listFetchSeq = 0;

	function ensureNumber(value: string | number | undefined | null): number {
		if (typeof value === 'number') return value;
		if (typeof value === 'string') return Number(value) || 0;
		return 0;
	}

	/** 评论附图仅展示图片（与接口「最多 6 张图」一致；视频另用封面/播放器） */
	function commentImageAssets(media: V1MediaAsset[] | undefined): V1MediaAsset[] {
		return (media ?? []).filter((m) => m.type === 'MEDIA_TYPE_IMAGE');
	}

	/** 多图网格最多展示 3 个槽位；超过 3 张时第三张上显示「共 n 张」 */
	function getGridSlotIndices(total: number): number[] {
		if (total <= 3) return Array.from({ length: total }, (_, i) => i);
		return [0, 1, 2];
	}

	let commentPreviewOpen = $state(false);
	let commentPreviewMediaList = $state<V1MediaAsset[]>([]);
	let commentPreviewInitialIndex = $state(0);

	function openCommentImagePreview(images: V1MediaAsset[], index: number) {
		if (images.length === 0) return;
		commentPreviewMediaList = images;
		commentPreviewInitialIndex = Math.min(Math.max(0, index), images.length - 1);
		commentPreviewOpen = true;
	}

	function mapApiComments(list: V1CommentWithReplies[] | undefined): CommentWithReplies[] {
		return (list ?? []).map((item) => {
			const base = item.comment ?? {};
			const replies = item.replies ?? [];

			return {
				...(base as V1Comment),
				_replies: [...replies],
				_repliesCursor: item.cursor,
				_repliesLoading: false,
				// 默认只展示第一条回复；需要时由用户手动展开
				_repliesExpanded: false
			};
		});
	}

	async function fetchComments(append: boolean) {
		if (!postId) return;
		if (append && !cursor) return;

		const snapshotPostId = postId;
		const snapshotOrder = orderType;
		const snapshotCursor = append ? cursor : undefined;

		let capturedSeq = 0;
		if (append) loadingMore = true;
		else {
			loading = true;
			listFetchSeq += 1;
			capturedSeq = listFetchSeq;
		}
		try {
			const res = await api.listPostComments(
				snapshotPostId,
				snapshotOrder,
				20,
				append && snapshotCursor ? snapshotCursor : undefined
			);

			// 帖子或排序已变：丢弃（含「切换最新/最热」时的竞态）
			if (postId !== snapshotPostId || orderType !== snapshotOrder) return;
			if (append && cursor !== snapshotCursor) return;
			if (!append && capturedSeq !== listFetchSeq) return;

			const list = mapApiComments(res.comments);
			const nextCursor = res.cursor;

			if (!append) {
				comments = list;
			} else {
				const byId = new SvelteMap<string, CommentWithReplies>();
				for (const c of comments) {
					byId.set(c.commentId ?? '', c);
				}
				for (const c of list) {
					const id = c.commentId ?? '';
					if (!byId.has(id)) {
						byId.set(id, c);
					}
				}
				comments = Array.from(byId.values());
			}

			cursor = nextCursor;
			if (res.comments && totalCount === 0) {
				totalCount = res.comments.length;
			}
		} catch (err) {
			console.error('加载评论失败', err);
			toast.error(messageForOperationError(err, '加载评论失败，请稍后重试'));
		} finally {
			if (append) {
				loadingMore = false;
			} else if (capturedSeq === listFetchSeq) {
				loading = false;
			}
		}
	}

	async function loadMoreComments() {
		await fetchComments(true);
	}

	$effect(() => {
		if (!cursor) return;
		if (loading || loadingMore) return;
		if (comments.length === 0) return;

		// 通过 window 滚动位置判断接近底部时自动加载（替代点击按钮）
		const thresholdPx = 320;
		const cooldownMs = 650;

		const y = scrollY;
		const h = windowInnerHeight;
		if (!h) return;

		const doc = document.documentElement;
		const reachedBottom = y + h + thresholdPx >= doc.scrollHeight;
		if (!reachedBottom) return;

		const now = Date.now();
		if (now - lastAutoLoadMoreAt < cooldownMs) return;
		lastAutoLoadMoreAt = now;

		loadMoreComments();
	});

	async function toggleOrder(type: V1CommentOrderType) {
		if (orderType === type) return;
		orderType = type;
		cursor = undefined;
		// 不在此处手动调用 fetchComments，由 $effect 自动追踪 orderType 变化并触发
	}

	async function loadMoreReplies(comment: CommentWithReplies) {
		if (!comment.commentId || comment._repliesLoading) return;

		comment._repliesLoading = true;
		try {
			const res = await api.listCommentReplies(
				comment.commentId,
				20,
				comment._repliesCursor || undefined
			);

			const replies = res.replies ?? [];

			const existing = comment._replies ?? [];
			const byId = new SvelteMap<string, V1Comment>();
			for (const r of existing) byId.set(r.commentId ?? '', r);
			for (const r of replies) {
				const id = r.commentId ?? '';
				if (!byId.has(id)) byId.set(id, r);
			}

			comment._replies = Array.from(byId.values());
			comment._repliesCursor = res.cursor;
			comment._repliesExpanded = true;
		} catch (err) {
			console.error('加载回复失败', err);
			toast.error(messageForOperationError(err, '加载回复失败，请重试'));
		} finally {
			comment._repliesLoading = false;
		}
	}

	/** 长评论折叠：与 post-detail 一致 */
	const COMMENT_CONTENT_LIMIT = 1000;
	let expandedContentIds = $state<Record<string, boolean>>({});
	/** 点赞请求进行中时禁止重复点击 */
	let likingCommentId = $state<string | null>(null);
	/** 与 post-detail 一致：最短反馈时长，保证 zoom 动画播完再结束态/失败回滚 */
	const LIKE_FEEDBACK_MIN_MS = 420;

	function hasLongContent(content: string): boolean {
		return (content?.length ?? 0) > COMMENT_CONTENT_LIMIT;
	}

	async function handleToggleLike(target: V1Comment | CommentWithReplies) {
		if (!target.commentId) return;
		if (likingCommentId === target.commentId) return;

		const currentStatus = target.relationStatus?.isLiked ?? false;
		const newStatus = !currentStatus;

		// 乐观更新：先更新 UI，与 post-detail 一致
		const patchTarget = target as V1Comment;
		const currentCount = ensureNumber(patchTarget.stats?.likeCount);
		if (patchTarget.stats) {
			patchTarget.stats.likeCount = String(currentCount + (newStatus ? 1 : -1));
		}
		if (patchTarget.relationStatus) {
			patchTarget.relationStatus.isLiked = newStatus;
		}

		likingCommentId = target.commentId;
		const t0 = Date.now();
		try {
			await api.setCommentLike(target.commentId, newStatus);
		} catch (err) {
			console.error('评论点赞失败', err);
			const wait = Math.max(0, LIKE_FEEDBACK_MIN_MS - (Date.now() - t0));
			await new Promise((r) => setTimeout(r, wait));
			if (patchTarget.stats) {
				patchTarget.stats.likeCount = String(currentCount);
			}
			if (patchTarget.relationStatus) {
				patchTarget.relationStatus.isLiked = currentStatus;
			}
			toast.error(messageForOperationError(err, '点赞失败，请重试'));
		} finally {
			const wait = Math.max(0, LIKE_FEEDBACK_MIN_MS - (Date.now() - t0));
			await new Promise((r) => setTimeout(r, wait));
			likingCommentId = null;
		}
	}

	export async function applyNewComment(newComment: V1Comment) {
		if (!newComment?.commentId) return;

		const isReply = !!newComment.replyContext?.parentCommentId;

		if (!isReply) {
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
		} else {
			const parentId = newComment.replyContext?.parentCommentId;
			if (!parentId) return;

			const list = [...comments];
			const target = list.find((c) => c.commentId === parentId);
			if (!target) {
				comments = list;
				return;
			}

			const existing = target._replies ?? [];
			target._repliesExpanded = true;
			target._replies = [...existing, newComment];

			const currentReplyCount = ensureNumber(target.stats?.replyCount);
			if (target.stats) {
				target.stats.replyCount = String(currentReplyCount + 1);
			}

			comments = list;
			totalCount = totalCount + 1;
			onTotalCountChange?.(1);
		}

		const cid = newComment.commentId ?? '';
		if (cid && hasLongContent(newComment.content ?? '')) {
			expandedContentIds = { ...expandedContentIds, [cid]: true };
		}

		await tick();
		requestAnimationFrame(() => {
			if (!cid) return;
			const el = document.querySelector(`[data-comment-id="${CSS.escape(cid)}"]`);
			el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		});
	}

	async function handleDeleteComment(comment: V1Comment | CommentWithReplies) {
		if (!comment.commentId) return;

		// 打开确认对话框
		commentToDelete = comment;
		deleteConfirmOpen = true;
	}

	async function handleReportComment(comment: V1Comment | CommentWithReplies) {
		if (!comment.commentId) return;

		// 打开举报确认对话框
		commentToReport = comment;
		reportConfirmOpen = true;
	}

	async function submitReport() {
		if (!commentToReport?.commentId) return;

		const body: V1ReportCommentRequest = {
			commentId: commentToReport.commentId,
			postId: commentToReport.targetId ?? postId
		};

		try {
			await api.reportComment(body);
		} catch (err) {
			console.error('举报评论失败', err);
			throw err;
		} finally {
			commentToReport = null;
		}
	}

	$effect(() => {
		fetchComments(false);
	});

	/**
	 * 判断当前评论是否还有未展开的回复数量
	 * - 接口层面的 replyCount 仅对「第一层评论」有意义
	 * - 这里保持完全依赖 stats.reply_count，不额外推断，保证与接口定义一致
	 */
	function getRemainingReplyCount(comment: CommentWithReplies): number {
		const total = ensureNumber(comment.stats?.replyCount);
		const loaded = comment._replies?.length ?? 0;
		return Math.max(0, total - loaded);
	}

	function toggleRepliesExpanded(comment: CommentWithReplies) {
		comment._repliesExpanded = !comment._repliesExpanded;
	}

	let activeMenuCommentId = $state<string | null>(null);

	function getDisplayedContent(content: string, commentId: string): string {
		const raw = content ?? '';
		if (raw.length <= COMMENT_CONTENT_LIMIT) return raw;
		if (expandedContentIds[commentId]) return raw;
		return raw.slice(0, COMMENT_CONTENT_LIMIT) + '…';
	}

	function toggleContentExpanded(commentId: string) {
		expandedContentIds = { ...expandedContentIds, [commentId]: !expandedContentIds[commentId] };
	}

	function toggleActionMenu(comment: V1Comment | CommentWithReplies) {
		const id = comment.commentId ?? null;
		activeMenuCommentId = activeMenuCommentId === id ? null : id;
	}

	function closeActionMenu() {
		activeMenuCommentId = null;
	}

	/** 内层回复是否直接回复「父级首条评论」，而非回复另一条内层回复 */
	function isDirectReplyToParent(reply: V1Comment): boolean {
		const rc = reply.replyContext;
		if (!rc?.parentCommentId || !rc.replyToCommentId) return false;
		return rc.replyToCommentId === rc.parentCommentId;
	}

	/** 仅当回复的是内层子评论时展示「回复 @谁」 */
	function showReplyToTargetUser(reply: V1Comment): boolean {
		const rc = reply.replyContext;
		if (!rc?.replyToUserName) return false;
		return !isDirectReplyToParent(reply);
	}

	const REPLY_ROW_INTERACTIVE = 'a, button, input, textarea, select, label';

	function isInteractiveCommentClickTarget(target: EventTarget | null): boolean {
		const el = target instanceof HTMLElement ? target : null;
		if (!el) return true;
		return !!el.closest(REPLY_ROW_INTERACTIVE);
	}

	function openReplyEditor(target: V1Comment) {
		onReply?.(target);
	}

	function handleTopLevelCommentRowClick(e: MouseEvent, comment: V1Comment) {
		if (isInteractiveCommentClickTarget(e.target)) return;
		activeCommentRowId = comment.commentId ?? null;
		openReplyEditor(comment);
	}

	function handleTopLevelCommentRowKeydown(e: KeyboardEvent, comment: V1Comment) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (isInteractiveCommentClickTarget(e.target)) return;
		e.preventDefault();
		activeCommentRowId = comment.commentId ?? null;
		openReplyEditor(comment);
	}

	function handleNestedReplyRowClick(e: MouseEvent, reply: V1Comment) {
		if (isInteractiveCommentClickTarget(e.target)) return;
		activeCommentRowId = reply.commentId ?? null;
		e.stopPropagation();
		openReplyEditor(reply);
	}

	function handleNestedReplyRowKeydown(e: KeyboardEvent, reply: V1Comment) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (isInteractiveCommentClickTarget(e.target)) return;
		e.preventDefault();
		activeCommentRowId = reply.commentId ?? null;
		e.stopPropagation();
		openReplyEditor(reply);
	}

	function handleDocumentClickForRowActiveState(e: MouseEvent) {
		const el = e.target instanceof HTMLElement ? e.target : null;
		if (!el) return;
		if (el.closest('[data-comment-row]')) return;
		activeCommentRowId = null;
	}

	/**
	 * 头像：加载失败时隐藏 img，仅显示外层圆形容器背景（无 alt 文案占位）。
	 *
	 * @param e - img error 事件
	 */
	function onCommentAvatarImageError(e: Event) {
		const el = e.currentTarget;
		if (el instanceof HTMLImageElement) el.style.display = 'none';
	}

	/**
	 * 评论附图：加载失败时隐藏 img，仅显示按钮背景。
	 *
	 * @param e - img error 事件
	 */
	function onCommentAttachmentImageError(e: Event) {
		const el = e.currentTarget;
		if (el instanceof HTMLImageElement) el.style.display = 'none';
	}
</script>

<svelte:window bind:scrollY bind:innerHeight={windowInnerHeight} />
<svelte:document onclick={handleDocumentClickForRowActiveState} />

{#snippet commentImagesAttachments(images: V1MediaAsset[], compact: boolean)}
	{#if images.length > 0}
		{#if images.length === 1}
			<button
				type="button"
				class={cn(
					'mt-2 block w-full overflow-hidden rounded-md border border-zinc-200/90 bg-zinc-100 text-left dark:border-zinc-700 dark:bg-zinc-800',
					compact ? 'max-w-48' : 'max-w-sm'
				)}
				onclick={() => openCommentImagePreview(images, 0)}
			>
				<img
					src={getMediaDisplayUrl(images[0])}
					alt=""
					role="presentation"
					class="aspect-4/3 max-h-72 w-full object-cover"
					loading="lazy"
					onerror={onCommentAttachmentImageError}
				/>
			</button>
		{:else}
			{@const total = images.length}
			{@const showBadge = total > 3}
			<div
				class={cn(
					'mt-2 grid gap-1',
					total === 2 ? 'grid-cols-2' : 'grid-cols-3',
					compact ? 'max-w-[180px]' : 'max-w-[240px]'
				)}
			>
				{#each getGridSlotIndices(total) as slotIdx (slotIdx)}
					<button
						type="button"
						class="relative aspect-square w-full overflow-hidden rounded-md border border-zinc-200/90 bg-zinc-100 text-left dark:border-zinc-700 dark:bg-zinc-800"
						onclick={() => openCommentImagePreview(images, slotIdx)}
					>
						<img
							src={getMediaDisplayUrl(images[slotIdx])}
							alt=""
							role="presentation"
							class="h-full w-full object-cover"
							loading="lazy"
							onerror={onCommentAttachmentImageError}
						/>
						{#if showBadge && slotIdx === 2}
							<span
								class="absolute right-1 bottom-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white"
							>
								共{total}张
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	{/if}
{/snippet}

<div
	class="mt-4 flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800"
>
	<span class="text-sm text-zinc-500">评论 {totalCount}</span>
	<div class="flex gap-2">
		<button
			class={cn(
				'cursor-pointer text-sm transition',
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
				'cursor-pointer text-sm transition',
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

<ul class="space-y-1">
	{#each comments as comment (comment.commentId)}
		<li class="py-3" data-comment-id={comment.commentId ?? ''}>
			<div
				class={cn(
					'-mx-1 flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-zinc-100/70 active:bg-zinc-200/70 dark:hover:bg-zinc-800/50 dark:active:bg-zinc-700/50',
					activeCommentRowId === (comment.commentId ?? null) &&
						'bg-zinc-100/90 dark:bg-zinc-800/60',
					commentRowFocusClass
				)}
				data-comment-row="top"
				role="button"
				tabindex="0"
				aria-label="回复该评论"
				onclick={(e) => handleTopLevelCommentRowClick(e, comment)}
				onkeydown={(e) => handleTopLevelCommentRowKeydown(e, comment)}
			>
				{#if comment.author?.userId && currentUserId && comment.author.userId === currentUserId}
					<a href={resolve('/app/profile')}>
						{#if comment.author?.avatar}
							<div
								class="size-8 shrink-0 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-600"
							>
								<img
									class="size-8 cursor-pointer rounded-full object-cover"
									src={comment.author.avatar}
									alt=""
									role="presentation"
									onerror={onCommentAvatarImageError}
								/>
							</div>
						{:else}
							<div class="size-8 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
						{/if}
					</a>
				{:else}
					<div class="shrink-0" role="presentation" onclick={(e) => e.stopPropagation()}>
						{#if comment.author?.avatar}
							<div
								class="size-8 shrink-0 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-600"
							>
								<img
									class="size-8 rounded-full object-cover"
									src={comment.author.avatar}
									alt=""
									role="presentation"
									onerror={onCommentAvatarImageError}
								/>
							</div>
						{:else}
							<div class="size-8 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
						{/if}
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class={cn('cursor-pointer text-sm', commentNameClass)}>
									{comment.author?.name ?? '用户'}
								</span>
							</div>
						</div>
						<div class="relative shrink-0">
							<button
								class="flex size-7 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
								onclick={() => toggleActionMenu(comment)}
								aria-label="更多操作"
							>
								<MoreHorizontal class="size-4" />
							</button>

							{#if activeMenuCommentId === comment.commentId}
								<div
									class="absolute right-0 z-10 mt-1 w-28 rounded-md border border-zinc-200 bg-white py-1 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
								>
									{#if currentUserId && comment.author?.userId === currentUserId}
										<button
											class="flex w-full cursor-pointer items-center px-3 py-1.5 text-left hover:bg-red-50 dark:hover:bg-zinc-800"
											onclick={() => {
												handleDeleteComment(comment);
												closeActionMenu();
											}}
										>
											删除
										</button>
									{:else}
										<button
											class="flex w-full cursor-pointer items-center px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
											onclick={() => {
												handleReportComment(comment);
												closeActionMenu();
											}}
										>
											举报
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>
					<div class="mt-0.5 space-y-1">
						<p class="cursor-text text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
							{getDisplayedContent(comment.content ?? '', comment.commentId ?? '')}
						</p>
						{#if hasLongContent(comment.content ?? '')}
							<button
								class="cursor-pointer text-xs font-medium text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
								onclick={() => toggleContentExpanded(comment.commentId ?? '')}
							>
								{expandedContentIds[comment.commentId ?? ''] ? '收起' : '查看全文'}
							</button>
						{/if}
					</div>
					{@render commentImagesAttachments(commentImageAssets(comment.media), false)}
					<p class="mt-2 cursor-text text-xs text-zinc-500">
						{formatTimeAgo(comment.createTime ?? '')}
					</p>
					<div class="mt-2 flex items-center gap-4 text-xs text-zinc-500">
						<button
							class="flex cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
							onclick={() => handleToggleLike(comment)}
							disabled={likingCommentId === comment.commentId}
						>
							{#key `${comment.commentId}-${likingCommentId === comment.commentId ? 'go' : 'idle'}`}
								<Heart
									class={cn(
										'size-3.5 origin-center',
										likingCommentId === comment.commentId &&
											'animate-in duration-300 ease-out fill-mode-forwards zoom-in-75',
										comment.relationStatus?.isLiked ? 'fill-rose-500 text-rose-500' : ''
									)}
									fill={comment.relationStatus?.isLiked ? 'currentColor' : 'none'}
								/>
							{/key}
							<span>{ensureNumber(comment.stats?.likeCount)}</span>
						</button>

						<button
							class="flex cursor-pointer items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
							onclick={() => onReply?.(comment)}
						>
							<MessageCircle class="size-3.5" />
							<span>{ensureNumber(comment.stats?.replyCount)}</span>
						</button>
					</div>

					{#if comment._replies && comment._replies.length > 0}
						<ul class="mt-2 space-y-2 pl-2 text-xs">
							{#each comment._repliesExpanded ? comment._replies : comment._replies.slice(0, 1) as reply (reply.commentId)}
								<li data-comment-id={reply.commentId ?? ''}>
									<div
										class={cn(
											'-mx-1 cursor-pointer rounded-md px-1 py-0.5 text-zinc-600 transition-colors hover:bg-zinc-100/70 active:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/50 dark:active:bg-zinc-700/50',
											activeCommentRowId === (reply.commentId ?? null) &&
												'bg-zinc-100/90 dark:bg-zinc-800/60',
											commentRowFocusClass
										)}
										data-comment-row="reply"
										role="button"
										tabindex="0"
										aria-label="回复该评论"
										onclick={(e) => handleNestedReplyRowClick(e, reply)}
										onkeydown={(e) => handleNestedReplyRowKeydown(e, reply)}
									>
										<div class="flex items-start justify-between gap-2">
											{#if reply.author?.userId && currentUserId && reply.author.userId === currentUserId}
												<a href={resolve('/app/profile')} class="shrink-0">
													{#if reply.author?.avatar}
														<div
															class="size-6 shrink-0 overflow-hidden rounded-full bg-zinc-300 active:bg-zinc-200/70 dark:bg-zinc-600 dark:active:bg-zinc-700/50"
														>
															<img
																class="size-6 rounded-full object-cover"
																src={reply.author.avatar}
																alt=""
																role="presentation"
																onerror={onCommentAvatarImageError}
															/>
														</div>
													{:else}
														<div class="size-6 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
													{/if}
												</a>
											{:else}
												<div
													class="shrink-0"
													role="presentation"
													onclick={(e) => e.stopPropagation()}
												>
													{#if reply.author?.avatar}
														<div
															class="size-6 shrink-0 overflow-hidden rounded-full bg-zinc-300 dark:bg-zinc-600"
														>
															<img
																class="size-6 rounded-full object-cover"
																src={reply.author.avatar}
																alt=""
																role="presentation"
																onerror={onCommentAvatarImageError}
															/>
														</div>
													{:else}
														<div class="size-6 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
													{/if}
												</div>
											{/if}
											<div class="min-w-0 flex-1">
												<span class={cn('text-xs', commentNameClass)}>
													{reply.author?.name ?? '用户'}
												</span>
												{#if showReplyToTargetUser(reply)}
													<p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
														回复 <span class={commentNameClass}
															>{reply.replyContext?.replyToUserName}</span
														>
													</p>
												{/if}
												<div class="mt-0.5 space-y-0.5">
													<p class="cursor-text whitespace-pre-wrap">
														{getDisplayedContent(reply.content ?? '', reply.commentId ?? '')}
													</p>
													{#if hasLongContent(reply.content ?? '')}
														<button
															class="cursor-pointer text-[11px] font-medium text-zinc-500 transition hover:text-zinc-700 dark:hover:text-zinc-300"
															onclick={() => toggleContentExpanded(reply.commentId ?? '')}
														>
															{expandedContentIds[reply.commentId ?? ''] ? '收起' : '查看全文'}
														</button>
													{/if}
												</div>
												{@render commentImagesAttachments(commentImageAssets(reply.media), true)}
												<p class="mt-2 cursor-text text-[11px] text-zinc-500">
													{formatTimeAgo(reply.createTime ?? '')}
												</p>
												<div class="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
													<button
														class="flex items-center gap-0.5 rounded-full px-1 py-0.5 transition hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-60 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
														onclick={() => handleToggleLike(reply)}
														disabled={likingCommentId === reply.commentId}
													>
														{#key `${reply.commentId}-${likingCommentId === reply.commentId ? 'go' : 'idle'}`}
															<Heart
																class={cn(
																	'size-3 origin-center',
																	likingCommentId === reply.commentId &&
																		'animate-in duration-300 ease-out fill-mode-forwards zoom-in-75',
																	reply.relationStatus?.isLiked ? 'fill-rose-500 text-rose-500' : ''
																)}
																fill={reply.relationStatus?.isLiked ? 'currentColor' : 'none'}
															/>
														{/key}
														<span>{ensureNumber(reply.stats?.likeCount)}</span>
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

												{#if activeMenuCommentId === reply.commentId}
													<div
														class="absolute right-0 z-10 mt-1 w-28 cursor-pointer rounded-md border border-zinc-200 bg-white py-1 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
													>
														{#if currentUserId && reply.author?.userId === currentUserId}
															<button
																class="flex w-full cursor-pointer items-center px-3 py-1.5 text-left hover:bg-red-50 dark:hover:bg-zinc-800"
																onclick={() => {
																	handleDeleteComment(reply);
																	closeActionMenu();
																}}
															>
																删除
															</button>
														{:else}
															<button
																class="flex w-full cursor-pointer items-center px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
																onclick={() => {
																	handleReportComment(reply);
																	closeActionMenu();
																}}
															>
																举报
															</button>
														{/if}
													</div>
												{/if}
											</div>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					{/if}

					{#if ensureNumber(comment.stats?.replyCount) > 1}
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
												ensureNumber(comment.stats?.replyCount) - (comment._replies?.length ?? 0)
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
	<div class="w-full py-2 text-center text-sm text-zinc-500">
		{loadingMore ? '加载中…' : '继续上拉加载更多'}
		<button class="sr-only" onclick={loadMoreComments} disabled={loadingMore}>加载更多</button>
	</div>
{/if}

<!-- 删除评论确认对话框 -->
<ConfirmDialog
	bind:open={deleteConfirmOpen}
	confirmVariant="default"
	confirmText="删除"
	onConfirm={async () => {
		if (!commentToDelete?.commentId) return;
		const commentId = commentToDelete.commentId;

		try {
			await api.deleteComment(commentId);

			let removedCount = 0;

			// 尝试作为顶层评论删除
			const topIndex = comments.findIndex((c) => c.commentId === commentId);
			if (topIndex !== -1) {
				const top = comments[topIndex];
				const repliesLen = top._replies?.length ?? 0;
				removedCount = 1 + repliesLen;
				comments = [...comments.slice(0, topIndex), ...comments.slice(topIndex + 1)];
			} else {
				// 尝试作为某个顶层评论的回复删除
				for (const c of comments) {
					if (!c._replies?.length) continue;
					const idx = c._replies.findIndex((r) => r.commentId === commentId);
					if (idx !== -1) {
						c._replies = [...c._replies.slice(0, idx), ...c._replies.slice(idx + 1)];
						removedCount = 1;

						const currentReplyCount = ensureNumber(c.stats?.replyCount);
						if (c.stats) {
							c.stats.replyCount = String(Math.max(0, currentReplyCount - 1));
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
			toast.error(messageForOperationError(err, '删除失败，请重试'));
		} finally {
			commentToDelete = null;
		}
	}}
	onCancel={() => {
		commentToDelete = null;
	}}
>
	{#snippet title()}
		<p class="text-lg font-semibold">删除评论</p>
	{/snippet}
	{#snippet description()}
		<p>确定要删除这条评论吗？此操作不可撤销。</p>
	{/snippet}
</ConfirmDialog>

<!-- 举报评论确认对话框 -->
<ConfirmDialog
	bind:open={reportConfirmOpen}
	confirmVariant="default"
	confirmText="举报"
	onConfirm={async () => {
		try {
			await submitReport();
			toast.success('举报成功');
		} catch (err) {
			console.error('举报评论失败', err);
			toast.error(messageForOperationError(err, '举报失败，请重试'));
			throw err;
		}
	}}
	onCancel={() => {
		commentToReport = null;
	}}
>
	{#snippet title()}
		<p class="text-lg font-semibold">举报评论</p>
	{/snippet}
	{#snippet description()}
		<p>确定要举报该评论吗？</p>
	{/snippet}
</ConfirmDialog>

<ImageVideoPreview
	bind:open={commentPreviewOpen}
	mediaList={commentPreviewMediaList}
	initialIndex={commentPreviewInitialIndex}
	autoplay={false}
	fullScreen={true}
/>
