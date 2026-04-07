<!--
  @component ScrollBadgeRow
  横向可滚动徽章容器：注册 `scrollBoundary` 的 x 轴，与 Feed / Swipe 等父级手势协同，避免内滑被外层抢走。
  子内容通常为 `VerifiedTitleBadge`、部门 `DepartmentBadge` 分组等。
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { scrollBoundary } from '$lib/modules/gesture';
	import { cn } from '$lib/utils.js';

	/**
	 * @param ariaLabel - 无障碍区域标签（默认「徽章」）
	 * @param class - 追加到滚动容器的 class
	 * @param children - 行内徽章片段
	 */
	let {
		ariaLabel = '徽章',
		class: className = '',
		children
	}: {
		ariaLabel?: string;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div
	class={cn(
		'flex min-w-0 flex-1 items-center gap-2 overflow-x-scroll overscroll-x-contain',
		className
	)}
	use:scrollBoundary={{ axis: 'x' }}
	role="region"
	aria-label={ariaLabel}
>
	{@render children()}
</div>
