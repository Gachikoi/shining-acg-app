<script lang="ts">
	import { resolve } from '$app/paths';
	import rectangleLogo from '$lib/assets/rectangle-logo.png';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { DOMAIN_CONFIG } from '$lib/constants';
	import { appState } from '$lib/stores/app-state.svelte';
	import SettingPopover from './setting-popover.svelte';

	let isRemoveLogo = $state(false);

	$effect(() => {
		const mql = window.matchMedia('(min-width: 40rem)');
		isRemoveLogo = mql.matches;
		const onChange = () => {
			isRemoveLogo = mql.matches;
		};
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});

	let debounceTimer: ReturnType<typeof setTimeout>;
	let localKeyword = $state(appState.searchKeyword);

	$effect(() => {
		const keywordToDebounce = localKeyword;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			appState.searchKeyword = keywordToDebounce;
		}, 500);
		return () => clearTimeout(debounceTimer);
	});
</script>

<header class="flex h-18 w-full items-center gap-2 px-4 lg:gap-4 lg:px-6">
	{#if isRemoveLogo}
		<section class="flex shrink-0 grow items-center justify-start lg:ml-4">
			<a class="shrink-0" href={resolve('/')}>
				<img src={rectangleLogo} alt="Shining!" width="110" height="33" />
			</a>
		</section>
	{/if}

	<Input
		bind:value={localKeyword}
		placeholder="搜索 Shining！"
		class="text-base sm:max-w-100 lg:max-w-120"
	/>

	<section class="flex shrink-0 grow items-center justify-end">
		<!-- eslint-disable -->
		<a
			title="晒你官网"
			href={`https://${DOMAIN_CONFIG.site}`}
			target="_blank"
			data-sveltekit-reload
			data-sveltekit-preload-code="eager"
			data-sveltekit-preload-data="tap"
		>
			<!-- eslint-enable -->
			<Button
				variant="ghost"
				class="hidden h-10 w-24 rounded-full text-base font-normal text-zinc-500 hover:text-zinc-500 lg:block dark:text-zinc-500"
				>晒你官网</Button
			></a
		>
		<div class="lg:hidden">
			<SettingPopover />
		</div>
	</section>
</header>
