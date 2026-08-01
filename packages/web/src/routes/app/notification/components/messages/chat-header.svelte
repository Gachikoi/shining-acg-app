<script lang="ts">
	import { ArrowLeft, MoreVertical, Search, X } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { Conversation } from './types';
	import type { MenuAnchor } from './types';

	let {
		conversation,
		threadSearchOpen = false,
		threadSearchQuery = '',
		isNarrow,
		onBack,
		onToggleFollow,
		onToggleThreadSearch,
		onThreadSearchQueryChange,
		onOpenMenu
	}: {
		conversation: Conversation;
		threadSearchOpen?: boolean;
		threadSearchQuery?: string;
		isNarrow: boolean;
		onBack: () => void;
		onToggleFollow: () => void;
		onToggleThreadSearch: (open: boolean) => void;
		onThreadSearchQueryChange: (query: string) => void;
		onOpenMenu: (anchor: MenuAnchor) => void;
	} = $props();

	let menuButtonEl = $state<HTMLButtonElement | null>(null);

	function handleMenuClick(event: MouseEvent) {
		event.stopPropagation();
		if (!menuButtonEl) return;
		const rect = menuButtonEl.getBoundingClientRect();
		onOpenMenu({ x: rect.left, y: rect.bottom + 4 });
	}
</script>

<div class="shrink-0 border-b border-zinc-100 dark:border-zinc-800">
	<div class="flex min-h-14 items-center gap-3 px-3 py-2">
		{#if isNarrow}
			<button
				type="button"
				class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
				aria-label="返回会话列表"
				onclick={onBack}
			>
				<ArrowLeft class="size-5" />
			</button>
		{/if}

		<div class="relative shrink-0">
			{#if conversation.participant.avatarUrl}
				<img
					src={conversation.participant.avatarUrl}
					alt=""
					class="size-10 rounded-full bg-zinc-900 object-cover"
				/>
			{:else}
				<div
					class="flex size-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white"
					aria-hidden="true"
				>
					{conversation.participant.nickname.slice(0, 1)}
				</div>
			{/if}
			{#if conversation.participant.online}
				<span
					class="absolute right-0 bottom-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950"
					aria-label="在线"
				></span>
			{/if}
		</div>

		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
				{conversation.participant.nickname}
			</p>
			<p class="truncate text-xs text-zinc-500">
				{conversation.participant.signature || (conversation.participant.online ? '在线' : '离线')}
			</p>
		</div>

		<div class="flex shrink-0 items-center gap-1">
			<button
				type="button"
				class={cn(
					'min-h-11 rounded-full px-4 text-sm font-medium',
					conversation.participant.following
						? 'border border-zinc-300 bg-transparent text-zinc-700 dark:border-zinc-600 dark:text-zinc-200'
						: 'bg-red-500 text-white hover:bg-red-600'
				)}
				onclick={onToggleFollow}
			>
				{conversation.participant.following ? '已关注' : '关注'}
			</button>

			<button
				type="button"
				class="inline-flex size-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
				aria-label={threadSearchOpen ? '关闭会话内搜索' : '打开会话内搜索'}
				aria-pressed={threadSearchOpen}
				onclick={() => onToggleThreadSearch(!threadSearchOpen)}
			>
				{#if threadSearchOpen}
					<X class="size-5" />
				{:else}
					<Search class="size-5" />
				{/if}
			</button>

			<button
				type="button"
				bind:this={menuButtonEl}
				class="inline-flex size-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
				aria-label="会话菜单"
				onclick={handleMenuClick}
			>
				<MoreVertical class="size-5" />
			</button>
		</div>
	</div>

	{#if threadSearchOpen}
		<div class="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
			<input
				type="search"
				value={threadSearchQuery}
				placeholder="搜索当前会话消息"
				maxlength={1000}
				class="min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
				oninput={(e) => onThreadSearchQueryChange(e.currentTarget.value)}
			/>
		</div>
	{/if}
</div>
