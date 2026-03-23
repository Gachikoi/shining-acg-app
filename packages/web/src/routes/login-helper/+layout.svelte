<script lang="ts">
	/**
	 * 登录助手域名的根布局：只提供主题、安全区与无文案的氛围底，正文全部由 `+page.svelte` 承担。
	 */
	let { children } = $props();
</script>

<svelte:head>
	<title>晒你 App</title>
</svelte:head>

<!--
  壳层：不放置任何营销文案，避免与 +page 的两行品牌字重复；
  光晕与网格仅作背景图形，与页面内的线面图形形成层次。
-->
<div
	class="relative isolate min-h-dvh overflow-x-hidden bg-background text-foreground selection:bg-primary/20 selection:text-foreground"
>
	<div
		class="pointer-events-none absolute top-0 -left-1/4 h-[min(55vh,28rem)] w-[min(120vw,48rem)] rounded-full bg-primary/7 blur-3xl dark:bg-primary/12"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute -right-1/3 bottom-0 h-[min(40vh,22rem)] w-[min(100vw,36rem)] rounded-full bg-chart-2/6 blur-3xl dark:bg-chart-4/8"
		aria-hidden="true"
	></div>

	<!-- 子页在视口内垂直居中，两侧留白随 max-w 收敛 -->
	<div
		class="relative mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
	>
		{@render children()}
	</div>
</div>
