<script lang="ts">
	import { dev } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Bell, House, SquarePen, UserCogIcon } from 'lucide-svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import Header from './header.svelte';
	import SettingPopover from './setting-popover.svelte';
	import TabButton from './tab-button.svelte';

	let { children } = $props();

	let isUpdateDialogShow = $state(false);

	async function detectSW() {
		try {
			const registration = await navigator.serviceWorker.register('/service-worker.js', {
				type: dev ? 'module' : 'classic'
			});

			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				if (!newWorker) return;

				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
						isUpdateDialogShow = true;
					}
				});
			});
		} catch (error) {
			console.error('Service Worker registration failed:', error);
		}

		let refreshing = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (refreshing) return;
			refreshing = true;
			window.location.reload();
		});
	}

	async function handleUpdate() {
		const registration = await navigator.serviceWorker.ready;
		if (registration.waiting) {
			registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		}
	}

	onMount(() => {
		detectSW();
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
			<TabButton text="首页" icon={House} href="/home" />
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

	<footer class="flex h-12 shrink-0 items-center justify-around lg:hidden">
		<TabButton text="首页" type="mobile" href="/home" />
		<TabButton badgeText="1" text="消息" type="mobile" href="/notification" />
		<TabButton text="发布" type="mobile" href="/release" />
		<TabButton badgeText="99+" text="管理" type="mobile" href="/management" />
		<TabButton img="www.google.com" text="我" type="mobile" href="/profile" />
	</footer>
</div>

<ModeWatcher></ModeWatcher>

<Dialog.Root bind:open={isUpdateDialogShow}>
	<Dialog.Content
		showCloseButton={false}
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior="ignore"
	>
		<Dialog.Header>
			<Dialog.Title>发现新版本</Dialog.Title>
			<Dialog.Description>系统已发布新版本，为了确保您的正常使用，请立即更新。</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button onclick={handleUpdate} variant="default" class="w-full">立即更新</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
