<script lang="ts">
	import { page } from '$app/state';
	import shiningLogo from '$lib/assets/shining-logo.jpg';
	import { NAV_ITEMS } from './constants';

	let {
		onNavigateHash
	}: {
		/** 若提供，则拦截默认锚点跳转，由父级统一平滑滚动 */
		onNavigateHash?: (hash: string) => void;
	} = $props();

	/** 与 background、锚点一致：首屏无 hash 视为首页 */
	const navHash = $derived(page.url.hash.length > 0 ? page.url.hash : NAV_ITEMS[0].hash);
</script>

<nav
	class="fixed top-0 left-0 z-20 flex h-20 w-full items-center justify-between border-b border-zinc-100 bg-white pr-8 pl-16 backdrop-blur-md transition-all duration-300"
>
	<!-- Logo Area -->
	<div class="group flex h-full cursor-pointer items-center gap-4">
		<img src={shiningLogo} alt="晒你动漫社" width="48" height="48" />
		<div
			class="flex flex-col justify-center *:font-mono *:font-black *:tracking-tighter *:text-zinc-900"
		>
			<span class="text-lg">晒你动漫社</span>
			<span class="text-sm">Shining ACG Fan Club</span>
		</div>
	</div>

	<!-- Navbar Links -->
	<div class="flex items-center gap-10">
		{#each NAV_ITEMS as item (item.hash)}
			<a
				href={item.hash}
				onclick={(e) => {
					if (onNavigateHash) {
						e.preventDefault();
						onNavigateHash(item.hash);
					}
				}}
				class="relative border-b-2 py-2 text-sm font-medium tracking-wide transition-colors duration-200 {navHash ===
				item.hash
					? 'border-red-500 text-zinc-900'
					: 'border-transparent text-zinc-500 hover:text-zinc-900'}"
			>
				{item.label}
				{#if navHash === item.hash}
					<span
						class="bg-brand-500 absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
					></span>
				{/if}
			</a>
		{/each}
	</div>
</nav>
