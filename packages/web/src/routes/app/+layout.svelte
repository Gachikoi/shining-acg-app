<script lang="ts">
	// import { startRealtimeAppManager, stopRealtimeAppManager } from '$lib/models/realtime';
	import { page } from '$app/state';
	import { appBus } from '$lib/events/app-bus';
	import { Bell, House, SquarePen, UserCogIcon } from 'lucide-svelte';
	import { onDestroy, onMount } from 'svelte';
	import Header from '../app/header.svelte';
	import SettingPopover from '../app/setting-popover.svelte';
	import TabButton from '../app/tab-button.svelte';
	import { FullScreenLoadingHost } from '$lib/components/custom/full-screen-loading';
	import { StackContainer } from '$lib/components/custom/stack';
	import { DOMAIN_CONFIG } from '$lib/constants';
	import Button from '$lib/components/ui/button/button.svelte';

	let { children } = $props();

	function handleHomeClick(event: MouseEvent) {
		if (page.url.pathname.includes('/home')) {
			event.preventDefault();
			appBus.emit('home:refresh');
		}
	}

	onMount(() => {
		// startRealtimeAppManager();
	});

	onDestroy(() => {
		// stopRealtimeAppManager();
	});
</script>

<svelte:head>
	<title>晒你 App</title>
</svelte:head>

<Header />
<div
	class="flex h-[calc(100vh-4.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col lg:flex-row"
>
	<aside class="m-4 mr-0 hidden flex-col justify-between lg:flex">
		<div class="flex flex-col gap-2">
			<TabButton onclick={handleHomeClick} text="首页" icon={House} href="/home" />
			<TabButton badgeText="1" text="消息" icon={Bell} href="/notification" />
			<TabButton text="发布" icon={SquarePen} href="/release" />
			<TabButton badgeText="99+" text="管理" icon={UserCogIcon} href="/management" />
			<TabButton img="www.google.com" text="我" href="/profile" />
			<Button class="h-12" href={`https://${DOMAIN_CONFIG.loginHelper}`}>登录</Button>
		</div>
		<SettingPopover></SettingPopover>
	</aside>

	<section
		class="h-[calc(100vh-4.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)-3rem)] grow lg:h-[calc(100vh-4.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]"
	>
		{@render children()}
	</section>

	<footer class="flex h-12 shrink-0 items-center justify-around lg:hidden">
		<TabButton onclick={handleHomeClick} text="首页" type="mobile" href="/home" />
		<TabButton badgeText="1" text="消息" type="mobile" href="/notification" />
		<TabButton text="发布" type="mobile" href="/release" />
		<TabButton badgeText="99+" text="管理" type="mobile" href="/management" />
		<TabButton img="www.google.com" text="我" type="mobile" href="/profile" />
	</footer>
</div>
<StackContainer maxVisible={2} />
<!-- zIndex 高于 StackItem（默认 zIndexBase=100），保证懒加载蒙版盖住栈页 -->
<FullScreenLoadingHost zIndex={10_000} />
