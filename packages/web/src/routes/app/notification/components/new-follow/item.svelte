<script lang="ts">
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';
	import UserIdentity from '../shared/user-identity.svelte';
	import { formatTimeAgo } from '../shared';
	import type { NewFollowNotificationItem } from './types';

	let {
		item,
		onStartDm,
		onFollowBack
	}: {
		item: NewFollowNotificationItem;
		onStartDm?: (userId: string) => void;
		onFollowBack?: (userId: string) => void;
	} = $props();

	let followPending = $state(false);

	const timeLabel = $derived(formatTimeAgo(item.createdAt));
	const relation = $derived(item.relation);

	function handleStartDm() {
		onStartDm?.(item.user.id);
	}

	function handleFollowBack() {
		if (followPending || relation === 'following' || relation === 'mutual') return;
		if (relation === 'unknown') {
			toast.error('暂时无法关注，请稍后重试');
			return;
		}
		followPending = true;
		onFollowBack?.(item.user.id);
	}
</script>

<div
	class={cn(
		'flex items-center justify-between gap-4 px-4 py-5 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50',
		!item.read && 'bg-zinc-50 dark:bg-zinc-900/40'
	)}
>
	<div class="min-w-0 flex-1">
		<UserIdentity
			userId={item.user.id}
			nickname={item.user.nickname}
			avatarUrl={item.user.avatarUrl}
			online={item.user.online}
			verifiedTitle={item.user.verifiedTitle}
			tags={item.user.tags}
		/>
		<p class="mt-1 text-sm text-zinc-500">
			开始关注了你
			{#if timeLabel}
				<span class="text-zinc-400"> · {timeLabel}</span>
			{/if}
		</p>
	</div>

	<div class="flex shrink-0 items-center gap-2">
		<button
			type="button"
			class="min-h-11 rounded-full border border-red-500 px-6 text-sm text-red-500 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:hover:bg-red-500/10"
			onclick={handleStartDm}
		>
			私信
		</button>

		{#if relation === 'none'}
			<button
				type="button"
				class="min-h-11 rounded-full bg-red-500 px-6 text-sm text-white hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none disabled:opacity-60"
				disabled={followPending}
				onclick={handleFollowBack}
			>
				回关
			</button>
		{:else if relation === 'following' || relation === 'mutual'}
			<button
				type="button"
				class="min-h-11 rounded-full border border-zinc-300 px-6 text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
				disabled
				aria-disabled="true"
			>
				已关注
			</button>
		{:else}
			<button
				type="button"
				class="min-h-11 rounded-full border border-zinc-300 px-6 text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-300"
				disabled
				aria-disabled="true"
				title="暂时无法关注，请稍后重试"
			>
				回关
			</button>
		{/if}
	</div>
</div>
