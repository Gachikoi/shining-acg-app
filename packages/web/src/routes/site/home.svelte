<script lang="ts">
	import type { Activity, Department } from './types';
	import Hero from './hero.svelte';

	let { item }: { item: Department | Activity } = $props();
</script>

<!--
	首页区块：锚点 #home，占满一屏；Hero 为既有主视觉
-->

<section id="home" class="flex w-full flex-col" aria-label="首页">
	<div class="flex min-h-0 w-full flex-1 flex-col justify-center">
		<Hero {item} />
	</div>
</section>
