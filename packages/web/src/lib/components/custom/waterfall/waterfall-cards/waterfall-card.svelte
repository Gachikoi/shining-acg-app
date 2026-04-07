<script lang="ts">
	import type { V1PostPreview } from '$lib/api/types.gen';
	import { stackController } from '$lib/components/custom/stack';
	import type { RectInfo } from '$lib/components/custom/stack/types';
	import PostDetail from '$lib/components/custom/post-detail/post-detail.svelte';
	import { createMockPostDetailApi } from '$lib/components/custom/post-detail/api-mock';
	import { breakpoint } from '$lib/modules/device';
	import { resolveCacheUrl } from '$lib/modules/cache';
	import { mockPostFromPreview } from '$lib/test/post-detail';
	import { cn, formatStat, formatTime } from '$lib/utils';
	import { Eye, Heart, PlayIcon } from 'lucide-svelte';

	/** 与瀑布流详情 Mock 会话共用一条内存 API（`createMockPostDetailApi`） */
	const feedCardPostDetailApi = createMockPostDetailApi();

	let {
		post,
		index,
		businessId,
		categoryId,
		isShowViews = true,
		isShowTime = true
	}: {
		post: V1PostPreview;
		/** 虚拟列表中的绝对下标，用于 `getFetchPriority` */
		index: number;
		businessId: string;
		categoryId: string;
		/** 是否展示封面浏览量角标（由父级 `WaterfallContainer` 控制） */
		isShowViews?: boolean;
		/** 是否展示作者区发布时间（由父级 `WaterfallContainer` 控制） */
		isShowTime?: boolean;
	} = $props();

	const getFetchPriority = $derived(
		index < (breakpoint.isLg ? 20 : breakpoint.isMd ? 10 : 5) ? 'high' : 'auto'
	);

	const cover = $derived({
		url: resolveCacheUrl(post.cover?.single?.url || '', businessId, categoryId),
		ratio:
			post.cover?.single?.meta?.width && post.cover.single.meta?.height
				? post.cover.single.meta.width / post.cover.single.meta.height
				: 1
	});
	const title = $derived(post.displayTitle || '');
	const author = $derived({
		avatar: resolveCacheUrl(post.author?.avatar, businessId, categoryId),
		name: post.author?.name || '',
		id: post.author?.userId || ''
	});
	const likeCount = $derived(formatStat(post.stats?.likeCount) || '0');
	const viewCount = $derived(formatStat(post.stats?.viewCount) || '0');

	/**
	 * 从已挂载节点读取视口相对矩形，供 Stack 进栈「从触点/卡片缩放展开」动画使用。
	 *
	 * @param el - 通常为卡片根节点（与 `getBoundingClientRect` 约定一致）
	 * @returns `RectInfo`
	 */
	function rectFromElement(el: HTMLElement): RectInfo {
		const r = el.getBoundingClientRect();
		return {
			top: r.top,
			left: r.left,
			width: r.width,
			height: r.height
		};
	}

	/**
	 * 命令式入全局栈：将预览映射为完整 `V1Post` 后交给 `PostDetail`，并传入触点矩形。
	 *
	 * @param e - 点击或键盘激活事件，`currentTarget` 为卡片根节点
	 */
	function openPostDetailFromStack(e: MouseEvent | KeyboardEvent): void {
		const el = e.currentTarget;
		if (!(el instanceof HTMLElement)) return;

		const fullPost = mockPostFromPreview(post, stackController.length);
		stackController.push({
			component: PostDetail,
			props: {
				post: fullPost,
				api: feedCardPostDetailApi,
				onClose: () => stackController.pop()
			},
			rectInfo: rectFromElement(el)
		});
	}
</script>

<div
	class={cn(
		'group cursor-pointer overflow-hidden rounded-sm border border-zinc-100 bg-white sm:rounded-md md:rounded-xl lg:rounded-2xl dark:border-zinc-900 dark:bg-black'
	)}
	role="button"
	tabindex="0"
	aria-label={title}
	onclick={openPostDetailFromStack}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openPostDetailFromStack(e);
		}
	}}
>
	<figure
		class="relative overflow-hidden rounded-t-sm bg-zinc-100 sm:rounded-t-md md:rounded-t-xl lg:rounded-t-2xl dark:bg-zinc-900"
	>
		<img
			class="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
			src={cover.url}
			alt={title}
			loading="eager"
			decoding="async"
			style="--aspect-ratio: {cover.ratio};"
			fetchpriority={getFetchPriority}
		/>
		{#if post.isOnlyVideo}
			<div class="absolute top-2 right-2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm">
				<PlayIcon class="size-3 fill-white stroke-white" aria-hidden="true"></PlayIcon>
			</div>
		{/if}
		{#if isShowViews}
			<div
				class="absolute bottom-2 left-2 flex items-center gap-0.75 rounded-full bg-black/40 p-1.5 backdrop-blur-sm *:text-white"
				aria-label="ViewCount {viewCount}"
			>
				<Eye class="size-4" aria-hidden="true" />
				<span class="text-xs font-medium">{viewCount}</span>
			</div>
		{/if}
	</figure>

	<footer class="p-3">
		<p class="line-clamp-2 text-sm leading-snug font-medium text-zinc-900 dark:text-zinc-100">
			{title}
		</p>
		<div class="mt-2 flex items-center gap-4" data-author-id={author.id}>
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<img
					class="size-5 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
					src={author.avatar}
					alt={author.name}
					fetchpriority={getFetchPriority}
				/>
				<div class="flex min-w-0 flex-col">
					<span class="truncate text-xs text-zinc-600 dark:text-zinc-400">{author.name}</span>
					{#if isShowTime}
						<span class="text-xs text-zinc-400 dark:text-zinc-500"
							>{formatTime(parseInt(post.publishTime || '0'))}</span
						>
					{/if}
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-0.75" aria-label="LikeCount {likeCount}">
				<Heart
					class="size-4 {post.relationStatus?.isLiked
						? 'fill-red-500 text-red-500'
						: 'text-zinc-500 dark:text-zinc-400'}"
					aria-hidden="true"
				/>
				<span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">{likeCount}</span>
			</div>
		</div>
	</footer>
</div>

<style>
	img {
		aspect-ratio: var(--aspect-ratio);
	}
</style>
