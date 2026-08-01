<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatTimeAccuracyFirst } from '$lib/utils/format-time';
	import { contextPopover } from '$lib/actions/context-popover';
	import { longPress } from '$lib/modules/gesture/actions/gestures/long-press/long-press.svelte';
	import type { Message } from './types';
	import type { MenuAnchor } from './types';

	let {
		message,
		onOpenMessageMenu
	}: {
		message: Message;
		onOpenMessageMenu: (messageId: string, anchor: MenuAnchor) => void;
	} = $props();

	function openMenuAt(x: number, y: number) {
		onOpenMessageMenu(message.id, { x, y });
	}

	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		openMenuAt(event.clientX, event.clientY);
	}
</script>

<div class={cn('flex', message.isOwn ? 'justify-end' : 'justify-start')}>
	<div
		class="max-w-[75%]"
		use:contextPopover={{ onTrigger: handleContextMenu }}
		use:longPress={{
			touchOnly: true,
			onPress: ({ clientX, clientY }) => openMenuAt(clientX, clientY)
		}}
	>
		<div
			class={cn(
				'rounded-2xl px-3 py-2 text-sm',
				message.isOwn
					? 'bg-red-50 text-zinc-900 dark:bg-red-950/40 dark:text-zinc-50'
					: 'border border-zinc-100 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50'
			)}
		>
			{#if message.quote && !message.recalled}
				<div
					class="mb-1 border-l-2 border-zinc-200 pl-2 text-xs text-zinc-500 dark:border-zinc-600"
				>
					<span class="font-medium">{message.quote.authorName}</span>
					<p class="truncate">{message.quote.text}</p>
				</div>
			{/if}

			{#if message.recalled}
				<p class="text-zinc-400 italic">{message.text ?? '消息已撤回'}</p>
			{:else if message.type === 'image'}
				{#if message.imageUrl}
					<img src={message.imageUrl} alt="图片消息" class="max-h-48 rounded-xl object-cover" />
				{:else}
					<div
						class="flex h-32 w-48 items-center justify-center rounded-xl bg-zinc-200 text-xs text-zinc-500 dark:bg-zinc-800"
						aria-label="图片消息"
					>
						[图片]
					</div>
				{/if}
			{:else}
				<p class="break-words whitespace-pre-wrap">{message.text}</p>
			{/if}
		</div>

		<time class="mt-1 block text-[0.625rem] text-zinc-400" datetime={message.createdAt}>
			{formatTimeAccuracyFirst(message.createdAt)}
			{#if message.status === 'sending'}
				· 发送中
			{:else if message.status === 'failed'}
				· 发送失败
			{/if}
		</time>
	</div>
</div>
