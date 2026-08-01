<script lang="ts">
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	let {
		targetId,
		thumbnailUrl,
		quote,
		onOpenTarget
	}: {
		targetId?: string;
		thumbnailUrl?: string;
		quote?: string;
		onOpenTarget?: (targetId: string) => void;
	} = $props();

	let imageFailed = $state(false);

	const showThumbnail = $derived(Boolean(thumbnailUrl) && !imageFailed);
	const showQuote = $derived(Boolean(quote?.trim()));

	function handleOpenTarget() {
		if (!targetId) return;
		if (onOpenTarget) {
			onOpenTarget(targetId);
			return;
		}
		// TODO: 对接通知目标路由跳转
		toast.message('暂未开放');
	}
</script>

<div class="flex shrink-0 flex-col items-end gap-2">
	{#if showThumbnail}
		<button
			type="button"
			class="min-h-11 min-w-11 overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
			aria-label="打开关联内容"
			onclick={handleOpenTarget}
		>
			<img
				src={thumbnailUrl}
				alt=""
				class="size-16 rounded-lg bg-zinc-200 object-cover dark:bg-zinc-800"
				onerror={() => {
					imageFailed = true;
				}}
			/>
		</button>
	{:else if targetId}
		<button
			type="button"
			class="flex size-16 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-500 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:bg-zinc-800 dark:text-zinc-400"
			aria-label="打开关联内容"
			onclick={handleOpenTarget}
		>
			预览
		</button>
	{/if}

	{#if showQuote}
		<p
			class={cn(
				'max-w-40 truncate border-l-2 border-zinc-200 pl-2 text-xs text-zinc-400 dark:border-zinc-700'
			)}
		>
			{quote}
		</p>
	{/if}
</div>
