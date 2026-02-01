<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLLabelAttributes } from 'svelte/elements';

	type Props = WithElementRef<HTMLLabelAttributes> & {
		children?: import('svelte').Snippet;
	};

	let { ref = $bindable(null), class: className, children, ...restProps }: Props = $props();
</script>

<label
	bind:this={ref}
	class={cn('text-base font-semibold text-zinc-900 dark:text-zinc-100', className)}
	{...restProps}
>
	{@render children?.()}
</label>
