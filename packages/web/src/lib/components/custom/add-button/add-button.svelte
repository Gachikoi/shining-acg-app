<!-- 新增按钮组件：统一的"新增"按钮样式，包含加号图标 -->
<script lang="ts">
	import { PlusCircle } from 'lucide-svelte';
	import { Button, type ButtonProps } from '$lib/components/ui/button';
	import type { Snippet } from 'svelte';

	let {
		class: className,
		children,
		...restProps
	}: Omit<ButtonProps, 'variant'> & {
		children?: Snippet;
	} = $props();
</script>

<Button
	variant="block"
	class="h-8 w-[4.75rem] justify-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 font-['Inter'] text-sm leading-5 font-medium tracking-normal text-zinc-900 hover:bg-zinc-200 {className ??
		''}"
	{...restProps}
>
	<PlusCircle class="size-4" />
	{#if children}
		{@render children()}
	{:else}
		新增
	{/if}
</Button>
