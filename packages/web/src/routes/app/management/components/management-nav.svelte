<script lang="ts">
	import { page } from '$app/state';
	import SortableButtonGroup from '$lib/components/custom/sortable-button-group.svelte';

	// 管理功能菜单项（从消息界面迁移过来，并改为 /management 路由）
	const MENU_ITEMS = [
		{ label: '举报受理', href: '/management/report' },
		{ label: '权限管理', href: '/management/permission' },
		{ label: '身份认证', href: '/management/identity' },
		{ label: '分区编辑', href: '/management/section' },
		{ label: '部门编辑', href: '/management/department' },
		{ label: '官网编辑', href: '/management/website' },
		{ label: '通知管理', href: '/management/notice' }
	];

	const STORAGE_KEY = 'management-menu-order';

	let currentPath = $derived(page.url.pathname);
</script>

<SortableButtonGroup
	items={MENU_ITEMS}
	storageKey={STORAGE_KEY}
	isActive={(item) => currentPath === item.href || currentPath.startsWith(item.href + '/')}
/>
