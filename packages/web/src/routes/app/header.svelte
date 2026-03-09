<script lang="ts">
	import { resolve } from '$app/paths';
	import rectangleLogo from '$lib/assets/rectangle-logo.png';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { DOMAIN_CONFIG } from '$lib/constants';
	import { breakpoint } from '$lib/modules/device';
	import { homeFeedRouteState } from '$lib/stores/feed';
	import { onDestroy } from 'svelte';
	import SettingPopover from './setting-popover.svelte';

	let debounceTimer: ReturnType<typeof setTimeout>;
	let localKeyword = $state(homeFeedRouteState.keyword);
	let lastCommittedKeyword = $state(homeFeedRouteState.keyword);

	/**
	 * 当搜索词从页面快照恢复、外部逻辑重置等“非输入框 typing”来源发生变化时，
	 * 需要把全局状态重新同步回输入框本地状态，否则 UI 会停留在旧值。
	 */
	$effect(() => {
		const externalKeyword = homeFeedRouteState.keyword;
		if (externalKeyword === lastCommittedKeyword) return;
		localKeyword = externalKeyword;
		lastCommittedKeyword = externalKeyword;
	});

	$effect(() => {
		const keywordToDebounce = localKeyword;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			homeFeedRouteState.keyword = keywordToDebounce;
			lastCommittedKeyword = keywordToDebounce;
		}, 500);
		return () => clearTimeout(debounceTimer);
	});

	onDestroy(() => {
		clearTimeout(debounceTimer);
	});
</script>

<header class="relative flex h-18 w-full items-center gap-2 pr-2 pl-6 lg:px-6">
	{#if breakpoint.isLg}
		<section class="flex shrink-0 grow items-center justify-start lg:ml-4">
			<a class="shrink-0" href={resolve('/')}>
				<img src={rectangleLogo} alt="Shining!" width="110" height="33" />
			</a>
		</section>
	{/if}

	<!-- `md` 及以上断点时，让搜索框脱离 flex 流并以整个 header 为基准绝对居中。 -->
	<div
		class="max-w-full min-w-0 flex-1 md:pointer-events-none md:absolute md:left-1/2 md:w-full md:max-w-100 md:-translate-x-1/2 lg:max-w-120"
	>
		<!-- 保持输入框自身可交互，同时在移动端继续占据主内容区域。 -->
		<Input
			bind:value={localKeyword}
			placeholder="搜索 Shining！"
			class="text-base md:pointer-events-auto"
		/>
	</div>

	<section class="flex items-center justify-end">
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
		<div class="md:absolute md:right-2 lg:hidden">
			<SettingPopover />
		</div>
	</section>
</header>
