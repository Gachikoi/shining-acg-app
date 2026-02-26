<script lang="ts">
	import darkLogo from '$lib/assets/dark-logo.png';
	import logo from '$lib/assets/logo.png';
	import { mode } from 'mode-watcher';
	import './layout.css';
	import { dev } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { onMount } from 'svelte';

	let { children } = $props();

	let isUpdateDialogShow = $state(false);

	async function detectSW() {
		if (!('serviceWorker' in navigator)) return;

		try {
			const registration = await navigator.serviceWorker.register('./service-worker.js', {
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
			console.error('Service Worker 注册失败:', error);
		}

		// 防止 controllerchange 事件被多次触发导致页面重复刷新
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
	<link rel="icon" href={mode.current === 'dark' ? darkLogo : logo} />
</svelte:head>

{@render children()}

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
