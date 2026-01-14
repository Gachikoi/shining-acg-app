<script>
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SettingPopover from './setting-popover.svelte';
</script>

<header class="flex h-18 w-full items-center gap-4 px-6">
	<section class="flex flex-1 items-center justify-start">
		<div
			class="hidden h-8 shrink-0 items-center rounded-full bg-red-500 px-2 font-black text-white md:flex"
		>
			Shining App
		</div>
	</section>

	<Input placeholder="搜索 Shining！" class="max-w-100 text-base" />

	<section class="flex flex-1 items-center justify-end">
		<a
			title="晒你官网"
			href="https://www.shiningacg.club"
			data-sveltekit-preload-code="eager"
			data-sveltekit-replacestate
			data-sveltekit-preload-data="tap"
		>
			<Button
				variant="ghost"
				class="hidden h-10 w-24 rounded-full text-base font-normal text-zinc-500 lg:block dark:text-zinc-400"
				>晒你官网</Button
			></a
		>
		<div class="lg:hidden">
			<SettingPopover />
		</div>
	</section>
</header>
