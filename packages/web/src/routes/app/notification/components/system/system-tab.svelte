<script lang="ts">
	let { active = false }: { active?: boolean } = $props();
</script>

<div
	id="notification-panel-system"
	role="tabpanel"
	aria-labelledby="notification-tab-system"
	hidden={!active}
	class="flex h-full items-center justify-center"
>
	<p class="text-sm text-zinc-400 dark:text-zinc-500">功能建设中</p>
</div>
