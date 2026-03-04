<!-- 删除按钮组件：统一的删除按钮样式，包含减号图标 -->
<script lang="ts">
	import { Minus } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let {
		onclick,
		disabled = false,
		class: className
	}: {
		onclick?: () => void;
		disabled?: boolean;
		class?: string;
	} = $props();
</script>

<button
	type="button"
	{onclick}
	{disabled}
	class={cn(
		'flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-800',
		className
	)}
>
	<Minus class="h-4 w-6 text-white" />
</button>
