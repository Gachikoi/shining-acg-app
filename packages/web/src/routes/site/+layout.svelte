<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import AboutWebsite from './about-website.svelte';
	import Activity from './activity.svelte';
	import Background from './background.svelte';
	import { DEPARTMENTS } from './constants';
	import Declaration from './declaration.svelte';
	import Department from './department.svelte';
	import Home from './home.svelte';
	import Navbar from './navbar.svelte';
	import Post from './post.svelte';
	import Us from './us.svelte';

	let { children } = $props();

	let activeItem = $state(DEPARTMENTS[0]);

	/** 由导航点击触发滚动时暂停 IntersectionObserver，避免与 hash 同步打架 */
	let pauseHashObserver = $state(false);

	/**
	 * 当前路径 + hash，供 SvelteKit 在 /site 等前缀下正确导航
	 */
	function urlWithHash(hash: string): string {
		if (!browser) return hash;
		const h = hash.startsWith('#') ? hash : `#${hash}`;
		return `${window.location.pathname}${window.location.search}${h}`;
	}

	/**
	 * 导航栏点击：替换 hash 并平滑滚到对应 section（整页滚动 + snap）
	 * @param hash - 如 #home
	 */
	function navigateToHash(hash: string) {
		if (!browser) return;
		pauseHashObserver = true;
		const id = hash.startsWith('#') ? hash.slice(1) : hash;
		void goto(urlWithHash(hash), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		}).then(() => {
			requestAnimationFrame(() => {
				document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
			setTimeout(() => {
				pauseHashObserver = false;
			}, 650);
		});
	}

	onMount(() => {
		if (!browser) return;

		document.documentElement.classList.add('site-scroll-snap');

		const initialHash = page.url.hash.length > 0 ? page.url.hash : '#home';
		const initialId = initialHash.slice(1);
		requestAnimationFrame(() => {
			document.getElementById(initialId)?.scrollIntoView({ behavior: 'instant', block: 'start' });
		});

		const sections = [...document.querySelectorAll<HTMLElement>('section[id]')];

		const observer = new IntersectionObserver(
			(entries) => {
				if (pauseHashObserver) return;
				const visible = entries
					.filter((e) => e.isIntersecting && e.intersectionRatio >= 0.3)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
				const best = visible[0];
				const id = best?.target?.id;
				if (!id) return;
				const nextHash = `#${id}`;
				const current = window.location.hash || '#home';
				if (nextHash === current) return;
				void goto(nextHash, { replaceState: true, noScroll: true, keepFocus: true });
			},
			{ root: null, threshold: [0.25, 0.35, 0.5, 0.65, 0.8] }
		);

		for (const s of sections) {
			observer.observe(s);
		}

		return () => {
			document.documentElement.classList.remove('site-scroll-snap');
			observer.disconnect();
		};
	});
</script>

<svelte:head>
	<title>晒你官网</title>
</svelte:head>

{@render children()}

<Navbar onNavigateHash={navigateToHash} />
<Background />

<div class="relative z-10 flex w-full flex-col">
	<Home item={activeItem} />
	<Us />
	<Department />
	<Activity />
	<Post />
	<Declaration />
	<AboutWebsite />
</div>

<style>
	/*
		整页纵向 scroll-snap：PC 滚轮 / 移动端 touch（touch-action: pan-y 由浏览器处理纵向滚动）
	*/
	:global(html.site-scroll-snap) {
		scroll-snap-type: y mandatory;
		scroll-padding-top: 5rem;
		touch-action: pan-y;
	}
</style>
