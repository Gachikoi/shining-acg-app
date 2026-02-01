<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { DepartmentInfo } from '$lib/types/website';

	let {
		departments = $bindable<DepartmentInfo[]>([]),
		activeIndex = $bindable(0),
		onAdd
	}: {
		departments?: DepartmentInfo[];
		activeIndex?: number;
		onAdd?: () => void;
	} = $props();

	function labelFor(dept: DepartmentInfo, index: number) {
		return dept.chineseName?.trim() || `未命名 ${index + 1}`;
	}
</script>

<div class="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
	<div class="flex flex-wrap gap-2">
		{#each departments as dept, index (dept.id ?? index)}
			<button
				type="button"
				class={cn(
					'min-w-[4rem] rounded-full px-4 py-1.5 text-sm transition-colors',
					activeIndex === index
						? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
						: 'bg-transparent font-normal text-zinc-700 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
				)}
				onclick={() => (activeIndex = index)}
			>
				{labelFor(dept, index)}
			</button>
		{/each}
	</div>

	<button
		type="button"
		class="flex size-8 items-center justify-center rounded-full border border-zinc-200 text-xl leading-none text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
		onclick={onAdd}
	>
		+
	</button>
</div>
