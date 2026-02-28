<script lang="ts">
	let { children } = $props();
</script>

<div class="flex h-full flex-col gap-4">
	<div class="min-h-0 flex-1">
		{@render children()}
	</div>
</div>
