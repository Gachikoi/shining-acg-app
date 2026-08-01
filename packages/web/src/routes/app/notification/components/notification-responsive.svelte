<!--
  @component NotificationResponsive
  页级响应式内容容器：禁止横向溢出；消息 Tab 双栏在其内部编排。
-->
<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		class: className,
		children
	}: {
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<div class={cn('h-full min-h-0 overflow-x-hidden', className)}>
	{#if children}
		{@render children()}
	{/if}
</div>
