<!--
  @component FullScreenLoadingHost
  全屏蒙版 + 转圈指示器的唯一挂载点；须放在应用布局中一次。
  显示与否由同目录 `full-screen-loading.svelte.ts` 导出的 `Loading` 单例控制。
-->
<script lang="ts">
	import Spinner from '$lib/components/ui/spinner/spinner.svelte';
	import { Loading } from './full-screen-loading.svelte';

	interface Props {
		/**
		 * 蒙版 z-index，需高于 Stack、Dialog 等全屏层时使用更大值
		 * @default 10000
		 */
		zIndex?: number;
	}

	let { zIndex = 10_000 }: Props = $props();
</script>

{#if Loading.visible}
	<div
		class="fixed inset-0 flex items-center justify-center bg-background/75 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[2px]"
		style:z-index={zIndex}
		aria-busy="true"
		aria-live="polite"
	>
		<Spinner class="size-10 text-primary" />
	</div>
{/if}
