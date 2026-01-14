<script lang="ts">
	import { Bell, House, SquarePen, UserCogIcon } from 'lucide-svelte';
	import { ModeWatcher } from 'mode-watcher';
	import Header from './components/header.svelte';
	import SettingPopover from './components/setting-popover.svelte';
	import TabButton from './components/tab-button.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>晒你 App</title>
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
	/>
</svelte:head>

<ModeWatcher></ModeWatcher>

<Header />
<div class="h-[calc(100vh-4.5rem)] flex flex-col lg:flex-row">
	<aside class="m-4 mr-0 hidden  flex-col justify-between lg:flex">
		<div class="flex flex-col gap-2">
			<TabButton text="首页" icon={House} href="/" />
			<TabButton badgeText="1" text="消息" icon={Bell} href="/notification" />
			<TabButton text="发布" icon={SquarePen} href="/release" />
			<TabButton badgeText="99+" text="管理" icon={UserCogIcon} href="/management" />
			<TabButton img="www.google.com" text="我" href="/profile" />
		</div>
		<SettingPopover></SettingPopover>
	</aside>

	<section class="grow px-6">
		{@render children()}
	</section>

	<footer class="flex items-center justify-around lg:hidden h-12">
		<TabButton text="首页" type="mobile" href="/" />
		<TabButton badgeText="1" text="消息" type="mobile" href="/notification" />
		<TabButton text="发布" type="mobile" href="/release" />
		<TabButton badgeText="99+" text="管理" type="mobile" href="/management" />
		<TabButton img="www.google.com" text="我" type="mobile" href="/profile" />
	</footer>
</div>
