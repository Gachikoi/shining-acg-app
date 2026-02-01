<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';

	// 管理功能菜单项
	const menuItems = [
		{ label: '举报受理', href: '/notification/report' },
		{ label: '权限管理', href: '/notification/permission' },
		{ label: '身份认证', href: '/notification/identity' },
		{ label: '分区编辑', href: '/notification/section' },
		{ label: '部门编辑', href: '/notification/department' },
		{ label: '官网编辑', href: '/notification/website' },
		{ label: '通知管理', href: '/notification/notice' }
	] as const;

	let currentPath = $derived(page.url.pathname);
</script>

<nav class="flex items-center gap-[10px] overflow-x-auto pb-2">
	{#each menuItems as item (item.href)}
		{@const isActive = currentPath === item.href}
		<a
			href={resolve(item.href)}
			data-sveltekit-preload-code="eager"
			data-sveltekit-replacestate
			data-sveltekit-preload-data="tap"
			class={cn(
				'flex h-10 w-24 items-center justify-center rounded-full px-4 py-2 text-base whitespace-nowrap transition-colors',
				isActive
					? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
					: 'font-normal text-zinc-900 hover:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-800'
			)}
		>
			{item.label}
		</a>
	{/each}
</nav>
