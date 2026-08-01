<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatTimeAccuracyFirst } from '$lib/utils/format-time';
	import { contextPopover } from '$lib/actions/context-popover';
	import { BellOff } from 'lucide-svelte';
	import type { Conversation } from './types';
	import type { MenuAnchor } from './types';

	const SWIPE_ACTION_WIDTH = 168;

	let {
		conversation,
		selected = false,
		swipeOpen = false,
		onSelect,
		onOpenMenu,
		onRevealActions,
		onReport,
		onTogglePin,
		onDelete,
		onCloseSwipe
	}: {
		conversation: Conversation;
		selected?: boolean;
		swipeOpen?: boolean;
		onSelect: () => void;
		onOpenMenu: (anchor: MenuAnchor) => void;
		onRevealActions: () => void;
		onReport: () => void;
		onTogglePin: () => void;
		onDelete: () => void;
		onCloseSwipe: () => void;
	} = $props();

	let offsetX = $state(0);
	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let tracking = $state(false);

	const snippet = $derived(conversation.lastMessageSnippet.trim() || '暂无消息');

	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onOpenMenu({ x: event.clientX, y: event.clientY });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onSelect();
		}
	}

	function handleTouchStart(event: TouchEvent) {
		const touch = event.touches[0];
		if (!touch) return;
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		tracking = true;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!tracking) return;
		const touch = event.touches[0];
		if (!touch) return;
		const dx = touch.clientX - touchStartX;
		const dy = touch.clientY - touchStartY;
		if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
			tracking = false;
			return;
		}
		if (dx < -10) {
			event.preventDefault();
			offsetX = Math.max(dx, -SWIPE_ACTION_WIDTH);
		} else if (swipeOpen || offsetX < 0) {
			offsetX = Math.min(0, dx + (swipeOpen ? -SWIPE_ACTION_WIDTH : 0));
		}
	}

	function handleTouchEnd() {
		tracking = false;
		if (offsetX <= -SWIPE_ACTION_WIDTH / 2) {
			offsetX = -SWIPE_ACTION_WIDTH;
			onRevealActions();
		} else {
			offsetX = 0;
			if (swipeOpen) onCloseSwipe();
		}
	}

	$effect(() => {
		if (swipeOpen) {
			offsetX = -SWIPE_ACTION_WIDTH;
		} else if (!tracking) {
			offsetX = 0;
		}
	});

	function stopPropagation(event: MouseEvent) {
		event.stopPropagation();
	}
</script>

<div class="relative overflow-hidden">
	<!-- 侧滑操作栏 -->
	<div
		class="absolute inset-y-0 right-0 flex w-[10.5rem]"
		aria-hidden={!swipeOpen && offsetX === 0}
	>
		<button
			type="button"
			class="flex min-h-11 flex-1 items-center justify-center bg-zinc-600 text-sm text-white"
			onclick={(e) => {
				stopPropagation(e);
				onReport();
			}}
		>
			举报
		</button>
		<button
			type="button"
			class="flex min-h-11 flex-1 items-center justify-center bg-emerald-500 text-sm text-white"
			onclick={(e) => {
				stopPropagation(e);
				onTogglePin();
			}}
		>
			{conversation.pinned ? '取消置顶' : '置顶'}
		</button>
		<button
			type="button"
			class="flex min-h-11 flex-1 items-center justify-center bg-red-500 text-sm text-white"
			onclick={(e) => {
				stopPropagation(e);
				onDelete();
			}}
		>
			删除
		</button>
	</div>

	<div
		role="button"
		tabindex="0"
		class={cn(
			'relative flex min-h-14 cursor-pointer items-center gap-3 bg-white px-3 py-2 transition-transform dark:bg-zinc-950',
			selected && 'bg-zinc-100 dark:bg-zinc-900',
			!selected && 'hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
		)}
		style:transform="translateX({offsetX}px)"
		onclick={(e) => {
			stopPropagation(e);
			if (swipeOpen) {
				onCloseSwipe();
				return;
			}
			onSelect();
		}}
		onkeydown={handleKeydown}
		use:contextPopover={{
			onTrigger: handleContextMenu
		}}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		aria-current={selected ? 'true' : undefined}
		aria-label={`与 ${conversation.participant.nickname} 的会话`}
	>
		<div class="relative shrink-0">
			{#if conversation.participant.avatarUrl}
				<img
					src={conversation.participant.avatarUrl}
					alt=""
					class="size-12 rounded-full bg-zinc-900 object-cover"
				/>
			{:else}
				<div
					class="flex size-12 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white"
					aria-hidden="true"
				>
					{conversation.participant.nickname.slice(0, 1)}
				</div>
			{/if}
			{#if conversation.participant.online}
				<span
					class="absolute right-0 bottom-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950"
					aria-label="在线"
				></span>
			{/if}
		</div>

		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
				{conversation.participant.nickname}
			</p>
			<p class="truncate text-sm text-zinc-500">{snippet}</p>
		</div>

		<div class="flex shrink-0 flex-col items-end gap-1">
			<time class="text-xs text-zinc-400" datetime={conversation.lastMessageAt}>
				{formatTimeAccuracyFirst(conversation.lastMessageAt)}
			</time>
			<div class="flex items-center gap-1.5">
				{#if conversation.muted}
					<BellOff class="size-4 text-zinc-400" aria-label="已静音" />
				{/if}
				{#if conversation.unreadCount > 0}
					<span class="size-2 rounded-full bg-red-500" aria-hidden="true"></span>
					<span class="sr-only">未读</span>
				{/if}
			</div>
		</div>
	</div>
</div>
