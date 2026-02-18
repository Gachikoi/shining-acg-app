<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert-dialog-footer"
	class={cn(
		'flex flex-row gap-0 border-t border-zinc-300 dark:border-zinc-700 [&>button]:flex-1 [&>button]:rounded-none [&>button]:border-0 [&>button]:text-sm [&>button]:font-medium [&>button:not(:first-child)]:border-l [&>button:not(:first-child)]:border-l-zinc-300 dark:[&>button:not(:first-child)]:border-l-zinc-700',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
