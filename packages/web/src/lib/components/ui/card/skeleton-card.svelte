<script lang="ts" module>
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	export interface SkeletonCardProps extends WithElementRef<HTMLAttributes<HTMLDivElement>> {
		aspectRatio?: number;
	}
</script>

<script lang="ts">
	let {
		aspectRatio = 1,
		class: className,
		ref = $bindable(null),
		...restProps
	}: SkeletonCardProps = $props();
</script>

<div
	bind:this={ref}
	data-slot="skeleton-card"
	class={cn('overflow-hidden rounded-xl border border-border bg-card shadow-lg', className)}
	{...restProps}
>
	<div class="relative w-full" style="aspect-ratio: {aspectRatio};">
		<div class="absolute inset-0 animate-pulse bg-muted"></div>
	</div>

	<div class="p-3">
		<div class="space-y-2">
			<div class="h-4 w-full animate-pulse rounded bg-muted"></div>
			<div class="h-4 w-3/4 animate-pulse rounded bg-muted"></div>
		</div>

		<div class="mt-4 flex items-center justify-between">
			<div class="flex items-center gap-1.5">
				<div class="size-5 animate-pulse rounded-full bg-muted"></div>
				<div class="h-3 w-16 animate-pulse rounded bg-muted"></div>
			</div>

			<div class="flex items-center gap-1">
				<div class="size-4 animate-pulse rounded bg-muted"></div>
				<div class="h-3 w-8 animate-pulse rounded bg-muted"></div>
			</div>
		</div>
	</div>
</div>
