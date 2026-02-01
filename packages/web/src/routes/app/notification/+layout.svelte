<script lang="ts">
	import ManagementNav from './components/management-nav.svelte';

	let { children } = $props();
</script>

<div class="flex flex-col gap-4">
	<ManagementNav />
	<div class="flex-1">
		{@render children()}
	</div>
</div>
