<script lang="ts">
	let { children } = $props();
</script>

<div class="flex h-full min-h-0 flex-col overflow-x-hidden">
	<div class="min-h-0 flex-1">
		{@render children()}
	</div>
</div>
