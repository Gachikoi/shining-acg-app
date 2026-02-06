<script lang="ts">
	import { Bell, House, SquarePen, UserCogIcon } from 'lucide-svelte';
	import { ModeWatcher } from 'mode-watcher';
	import Header from './header.svelte';
	import SettingPopover from './setting-popover.svelte';
	import TabButton from './tab-button.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>晒你 App</title>
</svelte:head>

<ModeWatcher></ModeWatcher>

<Header />
<div class="flex h-[calc(100vh-4.5rem)] flex-col lg:flex-row">
	<aside
		class="m-4 mr-0 hidden flex-col justify-between lg:sticky lg:top-0 lg:flex lg:h-[calc(100vh-4.5rem)] lg:self-start"
	>
		<div class="flex flex-col gap-2">
			<TabButton text="首页" icon={House} href="/" />
			<TabButton badgeText="1" text="消息" icon={Bell} href="/notification" />
			<TabButton text="发布" icon={SquarePen} href="/release" />
			<TabButton badgeText="99+" text="管理" icon={UserCogIcon} href="/management" />
			<TabButton img="www.google.com" text="我" href="/profile" />
		</div>
		<SettingPopover></SettingPopover>
	</aside>

	<section class="scrollbar-hide grow overflow-y-auto px-6">
		{@render children()}
	</section>

	<footer class="flex h-12 items-center justify-around lg:hidden">
		<TabButton text="首页" type="mobile" href="/" />
		<TabButton badgeText="1" text="消息" type="mobile" href="/notification" />
		<TabButton text="发布" type="mobile" href="/release" />
		<TabButton badgeText="99+" text="管理" type="mobile" href="/management" />
		<TabButton img="www.google.com" text="我" type="mobile" href="/profile" />
	</footer>
</div>
