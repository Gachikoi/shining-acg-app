<script lang="ts">
	// import { startRealtimeAppManager, stopRealtimeAppManager } from '$lib/models/realtime';
	import { page } from '$app/state';
	import { StackContainer } from '$lib/components/custom/stack';
	import Button from '$lib/components/ui/button/button.svelte';
	import { DOMAIN_CONFIG } from '$lib/constants';
	import { appBus } from '$lib/events/app-bus';
	import { Bell, House, SquarePen, UserCogIcon } from 'lucide-svelte';
	import { onDestroy, onMount } from 'svelte';
	import Header from '../app/header.svelte';
	import SettingPopover from '../app/setting-popover.svelte';
	import TabButton from '../app/tab-button.svelte';

	let { children } = $props();
	let appViewportHeight = $state<number | null>(null);

	const KEYBOARD_INSET_THRESHOLD_PX = 120;

	function isKeyboardLikelyOpen() {
		if (typeof window === 'undefined') return false;
		const vv = window.visualViewport;
		if (!vv) return false;
		const keyboardInset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
		return keyboardInset > KEYBOARD_INSET_THRESHOLD_PX;
	}

	function updateAppViewportHeight() {
		if (typeof window === 'undefined') return;
		const nextHeight = window.innerHeight;

		if (appViewportHeight === null) {
			appViewportHeight = nextHeight;
			return;
		}

		// 键盘弹起或地址栏动画导致高度收缩时，保持旧高度，不让底栏被顶起
		if (isKeyboardLikelyOpen()) return;
		if (nextHeight < appViewportHeight) return;

		appViewportHeight = nextHeight;
	}

	$effect(() => {
		if (typeof document === 'undefined') return;
		const stableVh = appViewportHeight ? `${appViewportHeight}px` : '100svh';
		document.documentElement.style.setProperty('--app-stable-vh', stableVh);
	});

	function handleHomeClick(event: MouseEvent) {
		if (page.url.pathname.includes('/home')) {
			event.preventDefault();
			appBus.emit('home:refresh');
		}
	}

	// 经验主义的边缘导航热区宽度，在这个边缘宽度内阻止 touchmove
	const EDGE_NAV_GUARD_PX = 36;

	/**
	 * 禁用横向 wheel 事件触发的浏览器前进/后退导航。
	 *
	 * 使用 >= 而非 >：当 |deltaX| == |deltaY| 时（触控板惯性衰减尾帧常见值为 (1,1)），
	 * 手势仍属于横向意图，若不拦截浏览器仍会触发历史导航。
	 * { passive: false } 是调用 preventDefault 的必要条件。
	 */
	function onWheel(e: WheelEvent) {
		if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
			e.preventDefault();
		}
	}

	/**
	 * 移动端浏览器左/右缘右/左滑返回的热区宽度
	 * 起笔落在此带内时，对 touchmove 事件进行拦截，防止浏览器触发前进/后退导航。
	 * 在 chrome mobile 中 e.preventDefault() 可能失效，这不是我们编写的代码的问题，是 chrome mobile 的 bug。我们已经尽力了，并且设置 touch-action: none 和 overscroll-behavior: none 是没用的。
	 */
	function onTouchMove(e: TouchEvent) {
		if (!e.cancelable) return;

		const w = window.innerWidth;
		const startedNearHorizontalEdge =
			e.touches[0].clientX < EDGE_NAV_GUARD_PX || e.touches[0].clientX > w - EDGE_NAV_GUARD_PX;

		if (startedNearHorizontalEdge) {
			e.preventDefault();
		}
	}

	onMount(() => {
		// startRealtimeAppManager();
		window.addEventListener('wheel', onWheel, { passive: false });
		window.addEventListener('touchmove', onTouchMove, { passive: false });
		updateAppViewportHeight();

		const vv = window.visualViewport;
		window.addEventListener('resize', updateAppViewportHeight);
		vv?.addEventListener('resize', updateAppViewportHeight);
		vv?.addEventListener('scroll', updateAppViewportHeight);

		return () => {
			// stopRealtimeAppManager();
			window.removeEventListener('wheel', onWheel);
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('resize', updateAppViewportHeight);
			vv?.removeEventListener('resize', updateAppViewportHeight);
			vv?.removeEventListener('scroll', updateAppViewportHeight);
		};
	});

	onDestroy(() => {});
</script>

<svelte:head>
	<title>晒你 App</title>
</svelte:head>

<Header />
<div
	class="flex h-[calc(var(--app-safe-vh)-4.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col lg:h-[calc(var(--app-safe-vh)-4.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] lg:flex-row"
	style={`--app-safe-vh: ${appViewportHeight ? `${appViewportHeight}px` : '100svh'}`}
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
		class="h-[calc(var(--app-safe-vh)-4.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)-3rem)] grow lg:h-[calc(var(--app-safe-vh)-4.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]"
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
<StackContainer maxVisible={20} zIndexBase={0} />
