<!--
  @component FeedList
  用户无限滚动列表组件，用于 contentType='list' 的分类。
  数据类型为 V1UserSummary（用户摘要），展示用户卡片列表。

  布局：每行一个用户卡片
  - 左：头像
  - 中：用户名 + 认证头衔 + 部门标签 / QQ 号 / 粉丝&获赞统计
  - 右：关注操作按钮

  交互：下拉刷新、触底加载、弹性动画完全委托给 FeedContainer。

  虚拟滚动：
  使用 `calculateGridVisibleRange`（O(1)，等高行）计算可见切片，
  以 topSpacerHeight / bottomSpacerHeight 填充上下占位空间。
  itemHeight 为每行边框盒高度（含 padding），首帧兜底约 80px，实测后以 border box 为准。
-->
<script lang="ts" module>
	import type { V1UserSummary } from '$lib/api/types.gen';

	/**
	 * FeedList 滚动位置快照。
	 * 只要模块不重新加载就可以一直持有这些数据。
	 */
	interface FeedListLayoutSnapshot {
		/**
		 * 持有快照时的 items 引用。
		 * 用于校验重新挂载时数据是否仍为同一份，防止错误地恢复到已失效的 scrollTop。
		 */
		itemRef: V1UserSummary[];
		/** 持有快照时的滚动位置（px） */
		scrollTop: number;
	}

	/** 模块级内存缓存：key = `${businessId}:${categoryId}`。 */
	const feedListSnapshotStore = new Map<string, FeedListLayoutSnapshot>();
</script>

<script lang="ts">
	import FeedContainer from '$lib/components/custom/feed-container/feed-container.svelte';
	import {
		DepartmentBadge,
		ScrollBadgeRow,
		VerifiedTitleBadge
	} from '$lib/components/custom/user-badge-row';
	import { Button, type ButtonProps } from '$lib/components/ui/button';
	import { resolveCacheUrl } from '$lib/modules/cache';
	import { breakpoint } from '$lib/modules/device';
	import { scrollBoundary, type FeedStreamConfig } from '$lib/modules/gesture';
	import { cn, formatStat } from '$lib/utils';
	import { calculateGridVisibleRange } from '$lib/utils/virtual-scroll';
	import { onMount } from 'svelte';

	/** 关注关系状态枚举（模拟，后续从 API 获取） */
	type RelationState = 'none' | 'following' | 'followed_by' | 'mutual';

	let {
		businessId,
		categoryId,
		items,
		loading = false,
		hasMore = true,
		showSkeleton = false,
		refreshing = false,
		onLoadMore,
		onRefresh,
		elasticConfig = {},
		features = { pull: true, loadMore: true },
		className = ''
	}: {
		businessId: string;
		categoryId: string;
		/** 用户摘要数据列表 */
		items: V1UserSummary[];
		/** 是否正在加载更多 */
		loading?: boolean;
		/** 是否还有更多数据 */
		hasMore?: boolean;
		/** 是否显示骨架屏 */
		showSkeleton?: boolean;
		/** 是否正在下拉刷新（由外部控制） */
		refreshing?: boolean;
		/** 加载更多回调 */
		onLoadMore?: () => void | Promise<void>;
		/** 下拉刷新回调 */
		onRefresh?: () => Promise<void>;
		/** Feed 流手势配置（可与默认合并） */
		elasticConfig?: Partial<FeedStreamConfig>;
		/** 下拉 / 触底能力开关 */
		features?: { pull?: boolean; loadMore?: boolean };
		className?: string;
	} = $props();

	// ─── FeedContainer 实例引用 ──────────────────────────────────

	/**
	 * FeedContainer 组件实例，通过 `bind:this` 获取。
	 * 用于调用 `scrollTo` / `scrollToTopAndRefresh`，无需持有原始 DOM 元素。
	 */
	let feedContainerRef: ReturnType<typeof FeedContainer> | undefined = $state();
	/**
	 * 列表容器根节点
	 */
	let containerWrapperEl: HTMLElement | null = null;

	// ─── 快照管理 ────────────────────────────────────────────────

	/**
	 * 将当前滚动位置保存为快照。
	 * 在组件卸载时（onDestroy）调用，以便同一分类下次挂载时恢复滚动位置。
	 */
	function persistScrollSnapshot(): void {
		if (!businessId || !categoryId || items.length === 0) return;
		feedListSnapshotStore.set(`${businessId}:${categoryId}`, {
			itemRef: items,
			scrollTop: currentScrollTop
		});
	}

	/**
	 * 尝试从缓存恢复滚动位置。
	 * 校验 snapshot.itemRef === items，确保数据引用一致才恢复，
	 * 防止在数据刷新后将 scrollTop 恢复到已无意义的位置。
	 *
	 * @returns 是否成功恢复
	 */
	function restoreScrollSnapshot(): boolean {
		const snapshot = feedListSnapshotStore.get(`${businessId}:${categoryId}`);
		if (!snapshot) return false;
		if (snapshot.itemRef !== items) return false;
		feedContainerRef?.scrollTo({ top: snapshot.scrollTop, behavior: 'instant' });
		currentScrollTop = snapshot.scrollTop;
		return true;
	}

	// ─── 虚拟滚动状态 ────────────────────────────────────────────

	/**
	 * 列表项高度，和 CSS 对齐
	 */
	const ITEM_HEIGHT = 100;

	/** 视口高度（px），由 FeedContainer.onViewportResize 更新 */
	let containerHeight = $state(0);
	/** 当前滚动位置（px），由 FeedContainer.onScrollFrame 更新 */
	let currentScrollTop = $state(0);

	/**
	 * 当前可见元素范围（闭区间 [start, end]）。
	 * containerHeight = 0 时（挂载前）渲染全量，防止首屏空白。
	 */
	const visibleRange = $derived(
		containerHeight > 0
			? calculateGridVisibleRange({
					count: items.length,
					itemHeight: ITEM_HEIGHT,
					scrollTop: currentScrollTop,
					viewportHeight: containerHeight
				})
			: { start: 0, end: items.length - 1 }
	);

	/** 当前可见用户切片 */
	const visibleItems = $derived(items.slice(visibleRange.start, visibleRange.end + 1));

	/**
	 * 上方占位高度（px）：等于隐藏行数 × itemHeight 估算。
	 * 代替实际 DOM 节点撑开滚动区域，保证 scrollTop 对应正确的视觉位置。
	 */
	const topSpacerHeight = $derived(visibleRange.start * ITEM_HEIGHT);

	/**
	 * 下方占位高度（px）：等于尾部隐藏行数 × itemHeight 估算。
	 * 确保 feedStream 触底计算（contentH - scrollTop - viewportH）得到正确的剩余距离。
	 */
	const bottomSpacerHeight = $derived(
		Math.max(0, (items.length - 1 - visibleRange.end) * ITEM_HEIGHT)
	);

	// ─── FeedContainer 回调 ──────────────────────────────────────

	/**
	 * FeedContainer scroll RAF 回调：同步 scrollTop 供虚拟滚动重算。
	 *
	 * @param scrollTop - 滚动容器当前 scrollTop（px）
	 */
	function handleScrollFrame({ scrollTop }: { scrollTop: number }): void {
		currentScrollTop = scrollTop;
	}

	// ─── 关注按钮 ────────────────────────────────────────────────

	/**
	 * 根据 user_id 的 hash 模拟关注关系状态。
	 * 后续从 API 中真实获取。
	 *
	 * @param user - 用户数据
	 * @returns 模拟的关注关系
	 */
	function mockRelation(user: V1UserSummary): RelationState {
		const hash = (user.userId ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
		const states: RelationState[] = ['none', 'following', 'followed_by', 'mutual'];
		return states[hash % states.length];
	}

	/**
	 * 关注按钮配置表（仅存静态配置）。
	 * size 不在此处计算，在模板中直接读取 breakpoint.isSm，保证响应式。
	 * 原因：`$state({...})` / `const {...}` 中的初始化表达式只执行一次，
	 *       即使用 `$state` 包裹也不会使内部值在依赖变化时重新计算，
	 *       必须用 `$derived` 或在模板中直接读取断点值才能响应 viewport 变化。
	 */
	const RELATION_BUTTON: Record<RelationState, { label: string; variant: ButtonProps['variant'] }> =
		{
			none: { label: '关注', variant: 'default' },
			followed_by: { label: '回关', variant: 'default' },
			following: { label: '已关注', variant: 'tertiary' },
			mutual: { label: '互相关注', variant: 'tertiary' }
		};

	// ─── 暴露给外部的方法 ──────────────────────────────────────────

	/**
	 * 滚动到顶部并触发下拉刷新动画。
	 * 用于外部程序化触发刷新（如 Tab 二次点击、顶部刷新按钮）。
	 * 完整动画逻辑由 FeedContainer 处理，FeedList 仅委托。
	 */
	export function scrollToTopAndRefresh(): void {
		feedContainerRef?.scrollToTopAndRefresh();
	}

	let containerWrapperObserver: ResizeObserver;

	onMount(() => {
		restoreScrollSnapshot();

		containerWrapperObserver = new ResizeObserver(([entry]) => {
			const h = Math.round(entry.contentRect.height);
			if (h === containerHeight) return;
			containerHeight = h;
		});
		containerWrapperObserver.observe(containerWrapperEl!);

		return () => {
			persistScrollSnapshot();
			containerWrapperObserver?.disconnect();
		};
	});
</script>

<div bind:this={containerWrapperEl} class={cn('h-full w-full px-2 md:px-4 lg:px-6', className)}>
	<FeedContainer
		bind:this={feedContainerRef}
		{loading}
		{hasMore}
		{showSkeleton}
		{refreshing}
		itemCount={items.length}
		{elasticConfig}
		features={{
			pull: features.pull !== false && !!onRefresh,
			loadMore: features.loadMore !== false
		}}
		{onRefresh}
		{onLoadMore}
		onScrollFrame={handleScrollFrame}
	>
		<!--
    虚拟滚动列表：
    - topSpacerHeight：上方 padding 代替隐藏的头部行（不渲染 DOM，但撑开滚动高度）
    - bottomSpacerHeight：下方 padding 代替隐藏的尾部行
    - 只渲染 visibleItems（当前可见切片），DOM 数量随 viewportHeight / itemHeightPx 线性增长
  -->
		<div style:padding-top="{topSpacerHeight}px" style:padding-bottom="{bottomSpacerHeight}px">
			<!-- 必须用 items 的引用做 key！！！否则在 refresh 后，再次计算 visibleItems 并且 start 发生变化时，就会造成整个页面卡死 -->
			{#key items}
				{#each visibleItems as user (user.userId ?? Math.random())}
					{@const relation = mockRelation(user)}
					{@const btn = RELATION_BUTTON[relation]}
					{@const likeAndCollect =
						formatStat(user.stats?.likeCountReceived ?? '0') +
						formatStat(user.stats?.collectCountReceived ?? '0')}
					<div
						class="flex items-center gap-3 rounded-2xl p-4 hover:bg-zinc-100 sm:gap-6 hover:dark:bg-zinc-900"
						class:animate-pulse={showSkeleton}
					>
						<!-- 头像 -->
						<div class="shrink-0">
							{#if showSkeleton}
								<div class="size-10 rounded-full bg-muted sm:size-12"></div>
							{:else}
								<img
									src={resolveCacheUrl(user.avatar, businessId, categoryId)}
									alt={user.name}
									class="size-10 rounded-full bg-muted object-cover sm:size-12"
								/>
							{/if}
						</div>

						<!-- 用户信息 -->
						<div class="min-w-0 flex-1">
							{#if showSkeleton}
								<div class="mb-1.5 h-4 w-32 rounded bg-muted"></div>
								<div class="mb-1 h-3 w-40 rounded bg-muted"></div>
								<div class="h-3 w-48 rounded bg-muted"></div>
							{:else}
								<!-- 第一行：用户名 + 认证 + 部门标签 -->
								<div class="flex items-center gap-2">
									<span class="shrink-0 truncate font-semibold">
										{user.name}
									</span>
									<ScrollBadgeRow>
										{#if user.verifiedTitle}
											<VerifiedTitleBadge title={user.verifiedTitle} />
										{/if}
										{#if user.departments && user.departments.length > 0}
											<div class="scrollbar-none flex shrink-0 gap-1 overflow-x-auto">
												{#each user.departments as dept (dept.id)}
													<DepartmentBadge name={dept.name} />
												{/each}
											</div>
										{/if}
									</ScrollBadgeRow>
								</div>

								<!-- 第二行：QQ 号 -->
								{#if user.qqNumber}
									<p class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
										QQ 号：{user.qqNumber}
									</p>
								{/if}

								<!-- 第三行：统计数据 -->
								<!-- role="region" 满足 a11y 要求：带触摸事件的非交互元素需声明 ARIA 角色 -->
								<div
									role="region"
									aria-label="用户统计数据"
									class="mt-0.5 flex min-w-0 flex-1 overflow-x-scroll text-sm text-zinc-500 dark:text-zinc-400"
									use:scrollBoundary={{ axis: 'x' }}
								>
									<span class="shrink-0">粉丝：{formatStat(user.stats?.followerCount)}</span>
									<span class="mx-1">|</span>
									<span class="shrink-0">获赞和收藏：{formatStat(likeAndCollect.toString())}</span>
								</div>
							{/if}
						</div>

						<!-- 操作按钮 -->
						<div class="shrink-0">
							{#if showSkeleton}
								<div class="h-8 w-20 rounded-md bg-muted"></div>
							{:else}
								<!-- size 在模板中实时读取 breakpoint.isSm，此处是 $derived 追踪上下文，完全响应式 -->
								<Button variant={btn.variant} size={breakpoint.isSm ? 'fix' : 'fix-sm'}>
									{btn.label}
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			{/key}
		</div>
	</FeedContainer>
</div>
