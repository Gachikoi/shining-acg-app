<script>
	import { resolve } from '$app/paths';
	import rectangleLogo from '$lib/assets/rectangle-logo.svg';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
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
</script>

<header class="flex h-18 w-full items-center gap-4 px-6">
	{#if isRemoveLogo}
		<section class="flex shrink-0 grow items-center justify-start lg:ml-4">
			<a class="shrink-0" href={resolve('/')}>
				<img src={rectangleLogo} alt="Shining!" />
			</a>
		</section>
	{/if}

	<Input placeholder="搜索 Shining！" class="text-base sm:max-w-100 lg:max-w-120" />

	<section class="flex shrink-0 grow items-center justify-end">
		<a
			title="晒你官网"
			href="https://www.shiningacg.club"
			data-sveltekit-preload-code="eager"
			data-sveltekit-replacestate
			data-sveltekit-preload-data="tap"
		>
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
