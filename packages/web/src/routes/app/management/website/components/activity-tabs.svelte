<script lang="ts">
	import type { ActivityInfo } from '$lib/types/website';
	import { cn } from '$lib/utils.js';

	let {
		activities = $bindable<ActivityInfo[]>([]),
		activeIndex = $bindable(0),
		onAdd
	}: {
		activities?: ActivityInfo[];
		activeIndex?: number;
		onAdd?: () => void;
	} = $props();

	function labelFor(activity: ActivityInfo, index: number) {
		return activity.chineseName?.trim() || `未命名 ${index + 1}`;
	}
</script>

<div class="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
	<div class="flex flex-wrap gap-2">
		{#each activities as act, index (act.id ?? index)}
			<button
				type="button"
				class={cn(
					'min-w-16 rounded-full px-4 py-1.5 text-sm transition-colors',
					activeIndex === index
						? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
						: 'bg-transparent font-normal text-zinc-700 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
				)}
				onclick={() => (activeIndex = index)}
			>
				{labelFor(act, index)}
			</button>
		{/each}
	</div>

	<button
		type="button"
		class="flex size-8 items-center justify-center rounded-full border border-zinc-200 leading-none text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
		onclick={onAdd}
	>
		+
	</button>
</div>
