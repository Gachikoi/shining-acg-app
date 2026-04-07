<!--
  @component DepartmentBadge
  用户所属部门标签：玫红系次要徽章，用于展示单个部门名称。
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils.js';

	/**
	 * @param name - 部门显示名称
	 * @param class - 追加到根 `Badge` 的 class
	 */
	let {
		name,
		class: className = ''
	}: {
		name: string;
		class?: string;
	} = $props();
</script>

<Badge
	variant="secondary"
	class={cn('shrink-0 bg-rose-50 text-rose-500 dark:bg-rose-500/20 dark:text-rose-300', className)}
>
	{name}
</Badge>
