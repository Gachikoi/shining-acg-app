<script lang="ts">
	import { cn } from '$lib/utils';
	import { Spinner } from '$lib/components/ui/spinner';
	import { EmptyState } from '$lib/components/custom/empty-state';
	import type { Snippet } from 'svelte';

	export type StateFeedbackVariant = 'empty' | 'loading' | 'error' | 'unavailable' | 'success';

	let {
		variant,
		message,
		onRetry,
		children
	}: {
		variant: StateFeedbackVariant;
		message?: string;
		onRetry?: () => void;
		children?: Snippet;
	} = $props();

	const defaultMessages: Record<StateFeedbackVariant, string> = {
		empty: '暂无数据',
		loading: '加载中…',
		error: '加载失败，请重试',
		unavailable: '暂未接入',
		success: '操作成功'
	};

	const displayMessage = $derived(message ?? defaultMessages[variant]);
</script>

<div class="flex h-full min-h-0 flex-col items-center justify-center px-4 py-8 text-center">
	{#if variant === 'empty'}
		<EmptyState message={displayMessage} class="w-full max-w-md border-none bg-transparent">
			{#if children}
				{@render children()}
			{:else}
				<p class="text-sm text-zinc-400">{displayMessage}</p>
			{/if}
		</EmptyState>
	{:else if variant === 'loading'}
		<Spinner class="mb-3 size-8 text-zinc-400" />
		<p class="text-sm text-zinc-400">{displayMessage}</p>
	{:else if variant === 'error'}
		<p class="text-sm text-zinc-600 dark:text-zinc-300">{displayMessage}</p>
		{#if onRetry}
			<button
				type="button"
				class={cn(
					'mt-4 min-h-11 rounded-full border border-zinc-300 px-4 text-sm text-zinc-700',
					'hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none',
					'dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900'
				)}
				onclick={onRetry}
			>
				重试
			</button>
		{/if}
	{:else if variant === 'unavailable'}
		<p class="text-sm text-zinc-400">{displayMessage}</p>
	{:else if variant === 'success'}
		<p class="text-sm text-zinc-600 dark:text-zinc-300">{displayMessage}</p>
	{/if}
</div>
