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
	import { untrack } from 'svelte';
	/** 单页包装组件（与 types.StackItem 数据结构同名冲突，故单独命名） */
	import StackItemView from './stack-item.svelte';
	import stackController from './stack.svelte';
	import type { StackContainerProps, StackItem } from './types';

	// ─── Props ──────────────────────────────────────────────────────

	let { zIndexBase = 100, maxVisible }: StackContainerProps = $props();

	/** 各栈 id → 对应包装组件实例，供可见性裁剪时查询子页 lifecycle */
	let itemRefs = $state<Record<string, ReturnType<typeof StackItemView>>>({});

	let _isAnimating = $state(false);

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
		// 一个 effect 只有在它所读取的对象发生变化时才会重新运行，而不是在其内部的属性发生变化时，所以 items 在变更时一定要创建新对象而不是原地变更。
		// 或者用 stackController.length 来响应 items 数组长度变化。并且因为 stackController.items 每次变更内容都是通过 push / pop，所以监听 length 就够了 // TODO 测试
		void stackController.items;
		void zIndexBase;
		void maxVisible;

		/** 每项为栈数据结构 StackItem（非 Svelte 组件） */
		let result: { item: StackItem; zIndex: number }[] = [];
		untrack(() => {
			// 需要从底部开始删除的元素数量
			let toDeleteCount =
				maxVisible !== undefined ? Math.max(0, stackController.items.length - maxVisible) : 0;

			result = stackController.items
				.map((item, index) => {
					// 如果 item 处于非活跃状态（不提供状态查询函数也属于非活跃状态），并且还需要删除 item，则返回 undefined 让这一条被过滤掉
					if (
						itemRefs[item.id]?.queryStatus?.() !== 'living' &&
						toDeleteCount > 0 &&
						index < stackController.items.length - 2 // 最后两个元素不删除（会呈现给用户）
					) {
						toDeleteCount--;
						return undefined;
					}
					return {
						item,
						zIndex: zIndexBase + index
					};
				})
				.filter((item) => item !== undefined);
		});

		return result;
	});
</script>

<!--
  使用 item.id 作为 {#each} key，确保 Svelte diff 算法能精确复用/销毁 DOM 节点：
  - 新 push 的元素在尾部插入，触发进栈动画
  - 出栈后 id 消失，对应 DOM 由 Svelte 卸载（动画已在 StackItem 内完成）
  - maxVisible 截断导致的卸载同样由 key 机制处理
-->
{#each visibleItemsWithZIndex as { item, zIndex } (item.id)}
	<StackItemView
		bind:this={
			() => {
				// 只要不将 itemRefs[item.id] 返回给 Svelte，Svelte 就会保留属性值，防止 item.id 的属性值被意外置为 null 导致 visibleItemsWithZIndex 中的 queryStatus 判断逻辑失效
			},
			(el) => {
				itemRefs[item.id] = el;
			}
		}
		{item}
		{zIndex}
		bind:_isAnimating
	/>
{/each}
