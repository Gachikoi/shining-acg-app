<!--
  @component StackContainer
  堆叠布局容器，负责渲染全局栈中的所有可见元素。

  应挂载在应用布局层（如 +layout.svelte），整个应用只需挂载一次。
  自身不占据布局空间（子元素均为 position: fixed），可置于布局任意位置。

  核心功能：
  - 订阅全局 stackState，响应式渲染可见元素列表
  - 按栈内下标分配递增 z-index，保证栈顶元素覆盖在最上层
  - 通过 maxVisible 限制同时渲染的元素数量，卸载早期入栈元素以节省内存
  - 将 onLeftSwipe 回调透传给各 StackItem

  使用方式（在 +layout.svelte 中挂载）：
    StackContainer zIndexBase={100} maxVisible={5} onLeftSwipe={handleLeftSwipe}
-->
<script lang="ts">
	import stackController from './stack.svelte';
	import StackItem from './stack-item.svelte';
	import type { StackContainerProps, StackItem as StackItemType } from './types';

	// ─── Props ──────────────────────────────────────────────────────

	let { zIndexBase = 100, maxVisible }: StackContainerProps = $props();

	// ─── 可见元素计算 ─────────────────────────────────────────────

	/**
	 * 当前需要渲染的元素列表，附带计算好的 z-index
	 *
	 * z-index 基于元素在完整栈中的全局下标计算，
	 * 确保即使 maxVisible 截断了显示，z-index 依然连续且正确。
	 *
	 * @example
	 * 栈共 10 项，maxVisible=3，zIndexBase=100：
	 * items[7] → zIndex=107, items[8] → zIndex=108, items[9] → zIndex=109（栈顶）
	 */
	const visibleItemsWithZIndex = $derived.by(() => {
		/** 可见元素的起始全局下标（0-based） */
		const startGlobalIdx =
			maxVisible !== undefined ? Math.max(0, stackController.items.length - maxVisible) : 0;

		return stackController.items
			.slice(startGlobalIdx)
			.map((item: StackItemType, localIdx: number) => ({
				item,
				/** 全局下标对应的 z-index，栈顶（最后入栈）z-index 最高 */
				zIndex: zIndexBase + startGlobalIdx + localIdx
			}));
	});
</script>

<!--
  使用 item.id 作为 {#each} key，确保 Svelte diff 算法能精确复用/销毁 DOM 节点：
  - 新 push 的元素在尾部插入，触发进栈动画
  - 出栈后 id 消失，对应 DOM 由 Svelte 卸载（动画已在 StackItem 内完成）
  - maxVisible 截断导致的卸载同样由 key 机制处理
-->
{#each visibleItemsWithZIndex as { item, zIndex } (item.id)}
	<StackItem
		{item}
		{zIndex}
		bind:_isAnimating={stackController.isAnimating}
		onLeftSwipe={item.onLeftSwipe}
	/>
{/each}
