<script lang="ts">
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';
	import UserIdentity from '../shared/user-identity.svelte';
	import TargetPreview from '../shared/target-preview.svelte';
	import { formatTimeAgo } from '../shared';
	import { LIKE_COLLECT_ACTION_LABELS, type LikeCollectNotificationItem } from './types';

	let {
		item,
		onOpenNotificationTarget
	}: {
		item: LikeCollectNotificationItem;
		onOpenNotificationTarget?: (payload: { type: string; id: string }) => void;
	} = $props();

	const actionLabel = $derived(LIKE_COLLECT_ACTION_LABELS[item.actionType] ?? '互动了你的内容');
	const timeLabel = $derived(formatTimeAgo(item.createdAt));

	function handleOpen() {
		if (onOpenNotificationTarget) {
			onOpenNotificationTarget({ type: item.actionType, id: item.targetId });
			return;
		}
		// TODO: 对接帖子/评论目标路由跳转
		toast.message('暂未开放');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleOpen();
		}
	}
</script>

<div
	role="button"
	tabindex="0"
	class={cn(
		'flex min-h-11 cursor-pointer items-start gap-4 px-4 py-4 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:hover:bg-zinc-900/50',
		!item.read && 'bg-zinc-50 dark:bg-zinc-900/40'
	)}
	aria-label={`${item.user.nickname} ${actionLabel}`}
	onclick={handleOpen}
	onkeydown={handleKeydown}
>
	<UserIdentity
		userId={item.user.id}
		nickname={item.user.nickname}
		avatarUrl={item.user.avatarUrl}
		online={item.user.online}
		avatarOnly
	/>

	<div class="min-w-0 flex-1">
		<p class="text-sm text-zinc-500">
			<span class="font-semibold text-zinc-900 dark:text-zinc-50">{item.user.nickname}</span>
			{` ${actionLabel}`}
			{#if timeLabel}
				<span class="text-zinc-400"> · {timeLabel}</span>
			{/if}
		</p>

		{#if item.summary}
			<p class="mt-1 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{item.summary}</p>
		{/if}
	</div>

	<TargetPreview targetId={item.targetId} thumbnailUrl={item.thumbnailUrl} quote={item.summary} />
</div>
