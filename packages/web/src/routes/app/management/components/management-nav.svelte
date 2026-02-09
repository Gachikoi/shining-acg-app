<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { draggableScroll } from '$lib/actions';
	import { cn } from '$lib/utils';

	// 管理功能菜单项（从消息界面迁移过来，并改为 /management 路由）
	const menuItems = [
		{ label: '举报受理', href: '/management/report' },
		{ label: '权限管理', href: '/management/permission' },
		{ label: '身份认证', href: '/management/identity' },
		{ label: '分区编辑', href: '/management/section' },
		{ label: '部门编辑', href: '/management/department' },
		{ label: '官网编辑', href: '/management/website' },
		{ label: '通知管理', href: '/management/notice' }
	] as const;

	let currentPath = $derived(page.url.pathname);

	// 判断路径是否匹配
	function isPathActive(href: string): boolean {
		// 直接比较路径，因为 currentPath 已经是完整路径
		return currentPath === href || currentPath.startsWith(href + '/');
	}
</script>

<nav
	use:draggableScroll={{
		direction: 'horizontal',
		dragThreshold: 5,
		scrollSpeed: 1,
		shouldPreventClick: (hasMoved) => hasMoved
	}}
	class="scrollbar-hide flex h-[72px] items-center gap-[10px] overflow-x-auto pb-2"
>
	{#each menuItems as item (item.href)}
		{@const isActive = isPathActive(item.href)}
		<a
			href={resolve(
				// @ts-expect-error - SvelteKit resolve 类型限制，实际路径存在
				item.href as ResolvePath
			)}
			draggable="false"
			data-sveltekit-preload-code="eager"
			data-sveltekit-replacestate
			data-sveltekit-preload-data="tap"
			class={cn(
				'flex h-10 w-24 items-center justify-center rounded-full px-4 py-2 text-base whitespace-nowrap transition-colors select-none',
				isActive
					? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
					: 'font-normal text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800'
			)}
		>
			{item.label}
		</a>
	{/each}
</nav>
