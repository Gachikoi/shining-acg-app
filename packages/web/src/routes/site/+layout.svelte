<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { swipe, type SwipeOptions, type SwipeState } from '$lib/modules/gesture';
	import { onMount } from 'svelte';
	import AboutWebsite from './about-website.svelte';
	import Activity from './activity.svelte';
	import Background from './background.svelte';
	import { DEPARTMENTS, NAV_ITEMS } from './constants';
	import Declaration from './declaration.svelte';
	import Department from './department.svelte';
	import Home from './home.svelte';
	import Navbar from './navbar.svelte';
	import Post from './post.svelte';
	import Us from './us.svelte';

	let { children } = $props();

	let activeItem = $state(DEPARTMENTS[0]);

	/**
	 * 平滑滚动到 section 进行中：为 true 时禁止再次 `navigateToHash` 与 swipe 提交，避免打断当前动画。
	 */
	let sectionNavAnimating = $state(false);

	/** 与 `swipe` 的 `commitThreshold` / `velocityThreshold` 一致，供按视口高度判定用 */
	const SITE_SWIPE_COMMIT_FRACTION = 0.1;

	/** `scrollend` 未触发时的兜底解锁时长（ms），避免锁死 */
	const SECTION_NAV_SCROLL_END_FALLBACK_MS = 900;

	/**
	 * 在 `scrollIntoView({ behavior: 'smooth' })` 之后监听一次滚动结束并解锁。
	 * 支持 `scrollend` 的浏览器用事件；否则仅靠超时兜底。
	 * @param onFinish - 解锁后调用（将 `sectionNavAnimating` 置为 false）
	 */
	function waitForSmoothScrollEnd(onFinish: () => void): void {
		if (!browser) {
			onFinish();
			return;
		}
		let timeoutId: number | null = null;
		const finish = () => {
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			document.removeEventListener('scrollend', onScrollEnd);
			onFinish();
		};
		function onScrollEnd() {
			finish();
		}
		document.addEventListener('scrollend', onScrollEnd);
		timeoutId = window.setTimeout(finish, SECTION_NAV_SCROLL_END_FALLBACK_MS);
	}

	/**
	 * 当前路径 + hash，供 SvelteKit 在 /site 等前缀下正确导航
	 * @param hash - 含或不含 `#` 的锚点
	 * @returns 带 pathname 的完整 URL 片段
	 */
	function urlWithHash(hash: string): string {
		if (!browser) return hash;
		const h = hash.startsWith('#') ? hash : `#${hash}`;
		return `${window.location.pathname}${window.location.search}${h}`;
	}

	/**
	 * 导航栏点击或滑动手势：替换 hash 并平滑滚到对应 section（hash 仅由点击与滑动更新，无滚动监听回写）
	 * @param hash - 如 `#home`
	 */
	function navigateToHash(hash: string): void {
		if (!browser) return;
		if (sectionNavAnimating) return;
		const id = hash.startsWith('#') ? hash.slice(1) : hash;
		sectionNavAnimating = true;
		void goto(urlWithHash(hash), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		})
			.then(() => {
				requestAnimationFrame(() => {
					const el = document.getElementById(id);
					if (!el) {
						sectionNavAnimating = false;
						return;
					}
					el.scrollIntoView({ behavior: 'smooth', block: 'start' });
					waitForSmoothScrollEnd(() => {
						sectionNavAnimating = false;
					});
				});
			})
			.catch(() => {
				sectionNavAnimating = false;
			});
	}

	/**
	 * 纵向滑动结束：仅在 `swipe` 已判定 `committed` 时切换相邻 section（阈值见 `siteSwipeOptions`）。
	 * @param s - swipe `onEnd` 状态
	 */
	function applySwipeSectionNavigation(s: SwipeState): void {
		if (!browser || !s.committed) return;

		const current = window.location.hash.length > 0 ? window.location.hash : NAV_ITEMS[0].hash;
		const idx = NAV_ITEMS.findIndex((i) => i.hash === current);
		const cur = idx === -1 ? 0 : idx;

		if (s.direction === 'up') {
			if (cur >= NAV_ITEMS.length - 1) return;
			navigateToHash(NAV_ITEMS[cur + 1].hash);
			return;
		}
		if (s.direction === 'down') {
			if (cur <= 0) return;
			navigateToHash(NAV_ITEMS[cur - 1].hash);
		}
	}

	/**
	 * 官网主列纵向滑动：与导航栏并列的唯二 hash 切换方式之一（另一为 Navbar 点击）
	 */
	const siteSwipeOptions: SwipeOptions = {
		axis: 'y',
		commitThreshold: SITE_SWIPE_COMMIT_FRACTION,
		disabled: () => sectionNavAnimating,
		onEnd: (s) => {
			applySwipeSectionNavigation(s);
		}
	};

	onMount(() => {
		if (!browser) return;

		/**
		 * 官网单页仅此处需要：在捕获阶段拦截 Ctrl/⌘+滚轮（含触控板捏合映射为带修饰键的 wheel），避免破坏整页布局。
		 * 必须使用 `{ passive: false }` 才能对 wheel 调用 `preventDefault`。
		 *
		 * @param event - 文档捕获阶段的滚轮事件
		 */
		const onWheelZoomBlock = (event: WheelEvent): void => {
			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
			}
		};
		const wheelOpts: AddEventListenerOptions = { capture: true, passive: false };
		document.addEventListener('wheel', onWheelZoomBlock, wheelOpts);

		const initialHash = page.url.hash.length > 0 ? page.url.hash : '#home';
		const initialId = initialHash.slice(1);
		requestAnimationFrame(() => {
			document.getElementById(initialId)?.scrollIntoView({ behavior: 'instant', block: 'start' });
		});

		return () => {
			document.removeEventListener('wheel', onWheelZoomBlock, wheelOpts);
		};
	});
</script>

<svelte:head>
	<title>晒你官网</title>
</svelte:head>

{@render children()}

<Navbar onNavigateHash={navigateToHash} />
<Background />

<!--
	子 section：一屏高 + scroll-margin-top（与 navbar h-20 对齐），锚点与 scrollIntoView 顶栏留白。
-->
<div
	class="relative z-10 flex w-full flex-col [&>section]:min-h-dvh [&>section]:shrink-0 [&>section]:scroll-mt-20"
	use:swipe={siteSwipeOptions}
>
	<Home item={activeItem} />
	<Us />
	<Department />
	<Activity />
	<Post />
	<Declaration />
	<AboutWebsite />
</div>
