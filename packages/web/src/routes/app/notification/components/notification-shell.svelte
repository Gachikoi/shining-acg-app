<!--
  @component NotificationShell
  通知中心页级布局：Tab 在白色圆角卡片上方，主内容在卡片内。
-->
<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		class: className,
		tabs,
		children
	}: {
		class?: string;
		tabs?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<div class={cn('flex h-full min-h-0 flex-col gap-4', className)}>
	{#if tabs}
		<!-- 为 ring-offset / 角标留出空间；overflow 裁切会切掉描边与小红点 -->
		<div class="shrink-0 px-2.5 py-3">
			{@render tabs()}
		</div>
	{/if}

	<div
		class="min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
	>
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>
