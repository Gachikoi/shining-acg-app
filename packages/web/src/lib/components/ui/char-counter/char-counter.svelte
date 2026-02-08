<!-- 字符计数器组件：显示当前字符数和最大字符数（格式：current/max） -->
<script lang="ts">
	let { current = 0, max = 0 }: { current: number; max: number } = $props();
</script>

<span class="text-sm text-zinc-500 dark:text-zinc-400">
	{current}/{max}
</span>
