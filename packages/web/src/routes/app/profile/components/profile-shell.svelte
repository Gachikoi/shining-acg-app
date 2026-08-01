<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		header,
		content
	}: {
		header: Snippet;
		content: Snippet;
	} = $props();
</script>

<div
	class="flex h-full min-h-0 w-full flex-col gap-6 overflow-x-hidden overflow-y-auto bg-transparent px-4 py-4 md:px-6"
>
	<section class="shrink-0">
		{@render header()}
	</section>
	<section class="min-h-0 flex-1">
		{@render content()}
	</section>
</div>
