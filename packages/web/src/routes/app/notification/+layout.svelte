<script lang="ts">
	let { children } = $props();
</script>

<div class="flex flex-col gap-4">
	<div class="flex-1">
		{@render children()}
	</div>
</div>
