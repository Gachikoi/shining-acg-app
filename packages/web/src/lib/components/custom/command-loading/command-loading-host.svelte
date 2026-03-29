<!--
  @component CommandLoadingHost
  蒙层 + Spinner，仅由 `Loading.show` / `mount` 使用。
  - **fullscreen**：fixed 铺满视口（挂到 `document.body`）
  - **scoped**：absolute 铺满父节点（挂到业务 `target`）
-->
<script lang="ts">
	import Spinner from '$lib/components/ui/spinner/spinner.svelte';

	interface Props {
		/**
		 * full：视口全屏 fixed；scoped：在父元素内 absolute 铺满
		 */
		placement?: 'fullscreen' | 'scoped';
		/**
		 * 仅 fullscreen 时生效
		 * @default 10000
		 */
		zIndex?: number;
	}

	let { placement = 'fullscreen', zIndex = 10_000 }: Props = $props();
</script>

<div
	class={placement === 'fullscreen'
		? 'fixed inset-0 flex items-center justify-center bg-background/75 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[2px]'
		: 'absolute inset-0 z-1 flex items-center justify-center bg-background/75 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[2px]'}
	style={placement === 'fullscreen' ? `z-index: ${zIndex}` : undefined}
	aria-busy="true"
	aria-live="polite"
>
	<Spinner class="size-10 text-primary" />
</div>
