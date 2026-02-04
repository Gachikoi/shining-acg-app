<script lang="ts">
	import darkLogo from '$lib/assets/dark-logo.png';
	import logo from '$lib/assets/logo.png';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { mode } from 'mode-watcher';
	import { onMount } from 'svelte';
	import './layout.css';

	let { children } = $props();
	let isUpdateDialogShow = $state(false);

	async function checkUpdate() {
		try {
			// 1. 获取本地当前缓存的响应（利用强缓存，瞬间返回）
			const localRes = await fetch(window.location.href, {
				cache: 'force-cache'
			});
			const localEtag = localRes.headers.get('etag');

			// 2. 获取服务器最新的 ETag
			const serverRes = await fetch(window.location.href, {
				method: 'HEAD',
				cache: 'no-cache'
			});
			const serverEtag = serverRes.headers.get('etag');

			if (localEtag && serverEtag && localEtag !== serverEtag) {
				isUpdateDialogShow = true;
			}
		} catch (e) {
			console.error('检查版本更新失败', e);
		}
	}

	async function handleUpdate() {
		// 直接刷新页面，浏览器会因为没有对应的 ETag 缓存而回源拉取最新版
		window.location.reload();
	}

	onMount(() => {
		// if (window.location.hostname !== 'localhost') {
		checkUpdate();
		// }
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
