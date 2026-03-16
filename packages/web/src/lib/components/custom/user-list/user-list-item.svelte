<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Spinner } from '$lib/components/ui/spinner';
	import type { UserListItemProps } from './types';
	import { formatCount } from './util';

	let {
		userId,
		displayName,
		avatar,
		qqNumber,
		followerCount,
		likeCollectCount,
		verifiedTitle,
		departmentNames = [],
		isFollowing = false,
		isFollowedBy = false,
		showFollowButton = true,
		showStats = true,
		showBadges = true,
		onItemClick,
		onFollowClick,
		followLoading = false
	}: UserListItemProps = $props();

	const followButtonLabel = $derived(
		isFollowing && isFollowedBy
			? '互相关注'
			: isFollowing
				? '已关注'
				: isFollowedBy
					? '回关'
					: '关注'
	);

	function handleItemClick() {
		if (userId && onItemClick) onItemClick(userId);
	}

	function handleFollowClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (userId && onFollowClick && !followLoading) onFollowClick(userId, !isFollowing);
	}
</script>

<article
	role="button"
	tabindex="-1"
	class="flex min-h-[4rem] w-full cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors duration-200 ease-in-out hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
	onclick={handleItemClick}
	onkeydown={(e) => e.key === 'Enter' && handleItemClick()}
>
	<!-- 头像 -->
	<div class="flex h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
		{#if avatar}
			<img src={avatar} alt={displayName} class="h-full w-full object-cover" loading="lazy" />
		{:else}
			<div class="flex h-full w-full items-center justify-center text-sm text-zinc-500">
				{displayName?.charAt(0) ?? '?'}
			</div>
		{/if}
	</div>

	<!-- 主信息区：昵称 + QQ + 统计 + 徽章 -->
	<div class="min-w-0 flex-1">
		<div class="flex items-center justify-between gap-2">
			<span
				class="min-w-0 flex-[2] truncate text-base font-medium text-foreground"
				title={displayName}
			>
				{displayName || '—'}
			</span>
			{#if showFollowButton && userId}
				<Button
					variant={isFollowing ? 'tertiary' : 'default'}
					size="fix-sm"
					class="min-h-11 min-w-20 shrink-0"
					onclick={handleFollowClick}
					disabled={followLoading}
					aria-label={followButtonLabel}
				>
					{#if followLoading}
						<Spinner class="size-4" />
					{:else}
						{followButtonLabel}
					{/if}
				</Button>
			{/if}
		</div>

		{#if qqNumber}
			<p class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
				QQ {qqNumber}
			</p>
		{/if}

		{#if showStats && (followerCount !== undefined || likeCollectCount !== undefined)}
			<div class="mt-1 flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
				{#if followerCount !== undefined}
					<span>{formatCount(followerCount)} 粉丝</span>
				{/if}
				{#if likeCollectCount !== undefined}
					<span>{likeCollectCount}</span>
				{/if}
			</div>
		{/if}

		{#if showBadges && (verifiedTitle || departmentNames.length > 0)}
			<div
				class="scrollbar-none mt-1.5 flex min-w-0 flex-1 gap-1.5 overflow-x-auto overflow-y-hidden"
				aria-label="认证与部门"
			>
				{#if verifiedTitle}
					<Badge variant="secondary" class="shrink-0 text-xs">
						{verifiedTitle}
					</Badge>
				{/if}
				{#each departmentNames as name (name)}
					<Badge variant="outline" class="shrink-0 text-xs">
						{name}
					</Badge>
				{/each}
			</div>
		{/if}
	</div>
</article>
