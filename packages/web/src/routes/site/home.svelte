<script lang="ts">
	import type { Activity, Department } from '$lib/types/site';
	import Hero from './hero.svelte';

	let { item }: { item: Department | Activity } = $props();
</script>

<!--
	首页区块：锚点 #home，占满一屏；Hero 为既有主视觉
-->

<section
	id="home"
	class="flex min-h-screen w-full shrink-0 snap-start scroll-mt-20 flex-col pt-20"
	aria-label="首页"
>
	<div class="flex min-h-[calc(100vh-5rem)] w-full flex-1 flex-col justify-center">
		<Hero {item} />
	</div>
</section>
