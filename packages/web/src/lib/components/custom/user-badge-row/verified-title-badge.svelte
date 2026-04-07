<!--
  @component VerifiedTitleBadge
  用户认证头衔徽章：琥珀色底 + BadgeCheck 图标，用于资料/列表等场景展示 `verifiedTitle`。
-->
<script lang="ts">
	import { BadgeCheck } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils.js';

	/**
	 * @param title - 认证头衔文案（与 API `verifiedTitle` 一致）
	 * @param class - 追加到根 `Badge` 的 class
	 */
	let {
		title,
		class: className = ''
	}: {
		title: string;
		class?: string;
	} = $props();
</script>

<Badge
	variant="default"
	class={cn(
		'shrink-0 items-center gap-0.5 bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
		className
	)}
>
	<BadgeCheck
		class="size-4! shrink-0 fill-amber-500 text-amber-50 dark:fill-amber-300 dark:text-amber-900"
		strokeWidth={2.5}
		aria-hidden="true"
	/>
	{title}
</Badge>
