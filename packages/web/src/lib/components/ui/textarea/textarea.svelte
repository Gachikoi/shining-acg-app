<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = WithElementRef<HTMLTextareaAttributes>;

	let { ref = $bindable(null), class: className, ...restProps }: Props = $props();
</script>

<textarea
	bind:this={ref}
	class={cn(
		'flex min-h-[80px] w-full resize-none rounded-2xl border-0 bg-zinc-100 px-3 py-2 text-base caret-red-500 shadow-xs ring-offset-background transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900',
		'focus:ring-0 focus:outline-none',
		'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
		className
	)}
	{...restProps}
/>
