<script lang="ts">
	import type { Activity, Department } from './types';

	let {
		items,
		activeItem = $bindable()
	}: {
		items: Department[] | Activity[];
		activeItem: Department | Activity;
	} = $props();
</script>

<div
	class="fixed bottom-0 left-0 z-40 w-full border-t border-zinc-100 bg-white/90 py-4 backdrop-blur-lg lg:py-6"
>
	<div
		class="scrollbar-hide mx-auto flex max-w-7xl items-center justify-center gap-4 overflow-x-auto px-6 pb-2 lg:justify-start lg:gap-6 lg:pb-0"
	>
		{#each items as item (item.id)}
			<button
				onclick={() => {
					activeItem = item;
				}}
				class="group relative shrink-0 transition-all duration-300 ease-out {activeItem.id ===
				item.id
					? 'w-24 -translate-y-4 lg:w-32'
					: 'w-16 hover:-translate-y-2 lg:w-20'}"
			>
				{#if activeItem.id === item.id}
					<div class="absolute -top-4 left-1/2 h-4 w-0.5 -translate-x-1/2 bg-zinc-800"></div>
				{/if}

				<div
					class="aspect-square overflow-hidden rounded-xl border-2 shadow-lg transition-all duration-300 {activeItem.id ===
					item.id
						? 'border-brand-500 shadow-brand-500/20 ring-brand-500/10 ring-4'
						: 'border-transparent hover:border-zinc-300'}"
				>
					<img
						src={item.image}
						alt={item.name}
						class="h-full w-full object-cover transition-transform duration-500 {activeItem.id ===
						item.id
							? 'scale-110'
							: 'zincscale group-hover:zincscale-0'}"
					/>
				</div>

				<div
					class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold tracking-wider whitespace-nowrap transition-opacity duration-300 {activeItem.id ===
					item.id
						? 'text-brand-500 opacity-100'
						: 'text-zinc-400 opacity-0'}"
				>
					{item.enName || item.name}
				</div>
			</button>
		{/each}
	</div>

	<div class="absolute right-12 bottom-1/2 hidden translate-y-1/2 lg:block">
		<div class="flex animate-bounce flex-col items-center gap-2">
			<span
				class="font-tech origin-center translate-x-2 rotate-90 text-[10px] tracking-widest text-zinc-400 uppercase"
				>Scroll</span
			>
			<div class="h-12 w-px bg-zinc-300"></div>
		</div>
	</div>
</div>
