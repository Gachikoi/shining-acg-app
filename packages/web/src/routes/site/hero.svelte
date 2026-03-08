<script lang="ts">
	import type { Activity, Department } from '$lib/types/site';
	import { Play } from 'lucide-svelte';

	let { item }: { item: Department | Activity } = $props();
</script>

<div
	class="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col items-center justify-center px-6 py-20 lg:h-[70vh] lg:flex-row lg:justify-between lg:px-24 lg:py-0"
>
	<!-- Left/Center: Visual Content -->
	<div class="group relative flex h-[50vh] w-full items-center justify-center lg:h-[70vh] lg:w-3/5">
		<!-- Abstract Background behind image -->
		<div
			class="absolute inset-0 scale-90 -rotate-3 overflow-hidden rounded-[3rem] border border-white bg-zinc-100 shadow-2xl shadow-zinc-200/50 transition-transform duration-700 ease-out group-hover:scale-100 group-hover:rotate-0 lg:scale-95"
		>
			<!-- Subtle pattern inside the card -->
			<div
				class="absolute inset-0 opacity-10"
				style="background-image: radial-gradient(#000 1px, transparent 1px); background-size: 20px 20px"
			></div>
		</div>

		<!-- Main Image -->
		<div
			class="relative h-full w-full transform overflow-hidden rounded-[2.5rem] shadow-2xl transition-all duration-700 ease-out group-hover:-translate-y-2"
			role="presentation"
		>
			{#key item.id}
				<img
					src={item.image}
					alt={item.name}
					class="animate-fade-in-up h-full w-full object-cover"
				/>
			{/key}

			<!-- Overlay Gradient -->
			<div
				class="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-60"
			></div>

			<!-- Intro Video Button -->
			<button
				class="group/btn hover:border-brand-500 hover:bg-brand-500 absolute right-8 bottom-8 flex items-center gap-3 rounded-full border border-white/40 bg-white/20 px-6 py-3 text-white backdrop-blur-md transition-all duration-300"
			>
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition-transform group-hover/btn:scale-110"
				>
					<Play />
				</span>
				<span class="font-tech text-sm font-bold tracking-widest">INTRO VIDEO</span>
			</button>
		</div>

		<!-- Right: Info Content -->
		<div class="flex w-full flex-col items-start pt-12 lg:w-2/5 lg:pt-0 lg:pl-16">
			{#key item.id}
				<div class="animate-slide-in-right">
					<!-- Title Area -->
					<h1
						class="relative mb-2 text-6xl leading-[0.9] font-black tracking-tighter text-zinc-900 uppercase italic lg:text-7xl"
					>
						{item.name}
						<div
							class="font-tech pointer-events-none absolute -top-10 -left-10 -z-10 text-[8rem] font-bold whitespace-nowrap text-zinc-100 opacity-50 select-none"
						>
							{item.enName}
						</div>
					</h1>

					<!-- Subtitle -->
					<div class="mb-8 flex items-center gap-3">
						<div class="bg-brand-500 h-0.5 w-12"></div>
						<h2 class="font-tech text-brand-500 text-xl font-medium tracking-wide lg:text-2xl">
							{item.enName}
						</h2>
					</div>

					<!-- Divider Graphic -->
					<div class="relative mb-8 h-px w-full overflow-hidden bg-zinc-200">
						<div class="absolute top-0 left-0 h-full w-1/3 bg-zinc-800"></div>
					</div>

					<!-- Description -->
					<p class="mb-10 max-w-md text-sm leading-relaxed text-zinc-500 lg:text-base">
						{item.description}
					</p>

					<!-- Meta/Links -->
					<div
						class="flex flex-wrap items-center gap-6 text-sm font-bold tracking-wider text-zinc-800 uppercase"
					>
						<a
							href="#site"
							class="hover:text-brand-500 hover:border-brand-500 border-b-2 border-transparent pb-1 transition-colors"
							>Official Site</a
						>
						<a
							href="#weibo"
							class="hover:text-brand-500 hover:border-brand-500 border-b-2 border-transparent pb-1 transition-colors"
							>Weibo</a
						>
						<a
							href="#wechat"
							class="hover:text-brand-500 hover:border-brand-500 border-b-2 border-transparent pb-1 transition-colors"
							>WeChat</a
						>
						<a
							href="#bilibili"
							class="hover:text-brand-500 hover:border-brand-500 border-b-2 border-transparent pb-1 transition-colors"
							>Bilibili</a
						>
					</div>

					<!-- 蓝色装饰盒子 -->
					<div
						class="absolute -right-24 bottom-1/4 hidden h-12 w-12 animate-pulse bg-blue-500 lg:block"
					></div>
				</div>
			{/key}
		</div>
	</div>
</div>
