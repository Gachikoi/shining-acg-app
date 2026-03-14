<script lang="ts">
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	type Props = ProgressPrimitive.RootProps & {
		class?: string;
	};

	let { class: className, value = 0, max = 100, ...restProps }: Props = $props();

	const percent = $derived(max > 0 ? Math.min(100, Math.max(0, ((value ?? 0) / max) * 100)) : 0);
</script>

<ProgressPrimitive.Root
	{value}
	{max}
	role="progressbar"
	aria-valuenow={value ?? 0}
	aria-valuemin={0}
	aria-valuemax={max}
	class={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)}
	{...restProps}
>
	<div
		class="h-full w-full flex-1 rounded-full bg-primary transition-transform ease-in-out"
		style="transform: translateX(-{100 - percent}%)"
	></div>
</ProgressPrimitive.Root>
