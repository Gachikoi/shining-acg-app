<script lang="ts">
	let { current = 0, max = 0 }: { current: number; max: number } = $props();
</script>

<span class="text-sm text-zinc-500 dark:text-zinc-400">
	{current}/{max}
</span>
