<!-- 空状态提示组件：显示列表为空时的提示信息 -->
<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		message = '暂无数据',
		class: className,
		children
	}: {
		message?: string;
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<div
	class={cn(
		'rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700',
		className
	)}
>
	{#if children}
		{@render children()}
	{:else}
		{message}
	{/if}
</div>
