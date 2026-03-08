<script lang="ts">
	import { DEPARTMENTS } from '$lib/constants/site';
	import { Menu } from 'lucide-svelte';
	import Background from './background.svelte';
	import Hero from './hero.svelte';
	import Navbar from './navbar.svelte';
	import Selector from './selector.svelte';

	let { children } = $props();

	let activeItem = $state(DEPARTMENTS[0]);
</script>

<svelte:head>
	<title>晒你官网</title>
</svelte:head>

{@render children()}
<div
	class="selection:bg-brand-500 relative min-h-screen w-full overflow-hidden bg-[#f8f9fa] font-sans text-zinc-800 selection:text-white"
>
	<Background />
	<Navbar />
	<!-- <VerticalSidebar /> -->

	<main class="relative flex min-h-screen items-center pt-20 pb-32">
		<Hero item={activeItem} />
	</main>

	<Selector items={DEPARTMENTS} bind:activeItem />

	<div class="fixed right-6 bottom-32 z-50 lg:hidden">
		<button
			class="shadow-brand-500/20 text-brand-500 rounded-full border border-zinc-100 bg-white p-4 shadow-xl"
		>
			<Menu />
		</button>
	</div>
</div>
