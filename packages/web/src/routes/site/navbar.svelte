<script lang="ts">
	import { NAV_ITEMS } from '$lib/constants/site';
</script>

<nav
	class="fixed top-0 left-0 z-50 flex h-20 w-full items-center justify-between border-b border-gray-100 bg-white/80 px-8 backdrop-blur-md transition-all duration-300"
>
	<!-- Logo Area -->
	<div class="group flex cursor-pointer items-center gap-2">
		<div
			class="bg-brand-500 shadow-brand-500/30 flex h-10 w-10 items-center justify-center rounded-lg text-xl font-bold text-white shadow-lg transition-transform group-hover:scale-105"
		>
			M
		</div>
		<span class="font-tech text-2xl font-bold tracking-wider text-gray-800"> miHoYo </span>
	</div>

	<!-- Center Links -->
	<div class="hidden items-center gap-10 md:flex">
		{#each NAV_ITEMS as item (item.href)}
			<!-- eslint-disable -->
			<a
				href={item.href}
				class="relative py-2 text-sm font-medium tracking-wide transition-colors {item.active
					? 'text-brand-500'
					: 'text-gray-500 hover:text-gray-900'}"
			>
				<!-- eslint-enable -->
				{item.label}
				{#if item.active}
					<span
						class="bg-brand-500 absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
					></span>
				{/if}
			</a>
		{/each}
	</div>
</nav>
