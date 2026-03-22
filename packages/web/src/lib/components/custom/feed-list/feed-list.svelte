<!--
  @component FeedList
  用户无限滚动列表组件，用于 contentType='list' 的分类。
  数据类型为 V1UserSummary（用户摘要），展示用户卡片列表。

  布局：每行一个用户卡片
  - 左：头像
  - 中：用户名 + 认证头衔 + 部门标签 / QQ 号 / 粉丝&获赞统计
  - 右：关注操作按钮
-->
<script lang="ts">
	import type { V1UserSummary } from '$lib/api/types.gen';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, type ButtonProps } from '$lib/components/ui/button';
	import { resolveCacheUrl } from '$lib/modules/cache';
	import { breakpoint } from '$lib/modules/device';
	import { scrollBoundary } from '$lib/modules/gesture';
	import { formatStat } from '$lib/utils';
	import { onDestroy, onMount } from 'svelte';
	import { stackController } from '../stack';

	/** 关注关系状态枚举（模拟，后续从 API 获取） */
	type RelationState = 'none' | 'following' | 'followed_by' | 'mutual';

	let {
		businessId,
		categoryId,
		items,
		loading = false,
		hasMore = true,
		showSkeleton = false,
		onLoadMore
		// onRefresh
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
		/** 加载更多回调 */
		onLoadMore?: () => void;
		// onRefresh?: () => Promise<void>;
	} = $props();

	// ─── 滚动加载 ──────────────────────────────────────────────────

	/** 滚动容器引用 */
	let scrollContainer: HTMLElement | undefined = $state();
	/** 底部哨兵元素引用 */
	let sentinelEl: HTMLElement | undefined = $state();
	/** IntersectionObserver 实例 */
	let observer: IntersectionObserver | undefined;

	onMount(() => {
		if (sentinelEl) {
			observer = new IntersectionObserver(
				(entries) => {
					if (entries[0].isIntersecting && hasMore && !loading && !showSkeleton) {
						onLoadMore?.();
					}
				},
				{ root: scrollContainer, threshold: 0, rootMargin: '200px' }
			);
			observer.observe(sentinelEl);
		}
	});

	onDestroy(() => {
		observer?.disconnect();
	});

	/**
	 * 根据 user_id 的 hash 模拟关注关系状态
	 * 后续从 API 中真实获取
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
	 * 关注按钮配置表（仅存静态配置）
	 * size 不在此处计算，在模板中直接读取 breakpoint.isSm，保证响应式
	 * 原因：$state({...}) / const {...} 中的初始化表达式只执行一次，
	 *       即使用 $state 包裹也不会使内部值在依赖变化时重新计算，
	 *       必须用 $derived 或在模板中直接读取断点值才能响应 viewport 变化
	 */
	const RELATION_BUTTON: Record<RelationState, { label: string; variant: ButtonProps['variant'] }> =
		{
			none: { label: '关注', variant: 'default' },
			followed_by: { label: '回关', variant: 'default' },
			following: { label: '已关注', variant: 'tertiary' },
			mutual: { label: '互相关注', variant: 'tertiary' }
		};
</script>

<div
	class="scrollbar-hidden h-full overflow-y-scroll px-2 md:px-4 lg:px-6"
	bind:this={scrollContainer}
>
	<div>
		{#each items as user (user.userId ?? Math.random())}
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
				<div
					class="shrink-0"
					onclick={() =>
						stackController.push({
							loader: () => import('../../../../routes/app/home/+page.svelte')
						})}
				>
					{#if showSkeleton}
						<div class="size-10 rounded-full bg-muted sm:size-12"></div>
					{:else}
						<img
							src={resolveCacheUrl(user.avatar, `${businessId}-${categoryId}`)}
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
							<div
								class="flex min-w-0 flex-1 items-center gap-2 overflow-x-scroll overscroll-x-contain"
								use:scrollBoundary={{ axis: 'x' }}
								role="region"
								aria-label="徽章"
							>
								{#if user.verifiedTitle}
									<Badge
										variant="default"
										class="shrink-0 items-center gap-0.5 bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="24"
											height="24"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="lucide lucide-badge-check-icon lucide-badge-check size-4! fill-amber-500 text-amber-50 dark:fill-amber-300 dark:text-amber-900"
											><path
												stroke-width="0"
												d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
											/><path d="m9 12 2 2 4-4" /></svg
										>
										{user.verifiedTitle}
									</Badge>
								{/if}
								{#if user.departments && user.departments.length > 0}
									<div class="scrollbar-none flex shrink-0 gap-1 overflow-x-auto">
										{#each user.departments as dept (dept.id)}
											<Badge
												variant="secondary"
												class="shrink-0 bg-rose-50 text-rose-500 dark:bg-rose-500/20 dark:text-rose-300"
											>
												{dept.name}
											</Badge>
										{/each}
									</div>
								{/if}
							</div>
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
				<div class="shrink-0" onclick={() => stackController.pop()}>
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
	</div>

	<!-- 底部状态 -->
	<div class="py-4 text-center text-sm text-muted-foreground" bind:this={sentinelEl}>
		{#if loading}
			加载中...
		{:else if !hasMore && items.length > 0}
			没有更多了
		{/if}
	</div>
</div>
