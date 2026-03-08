<!--
  @component SwipeablePane
  可滑动面板容器，管理 3 个面板的"虚拟窗口"。

  核心行为：
  - 始终只渲染最多 3 个面板（prev / current / next），按需创建/销毁
  - 手势滑动时实时预览相邻面板，松手后平滑过渡
  - 非相邻 Tab 点击时，将目标分类临时放入相邻槽位，播放单步滑动动画
  - 每个面板独立管理滚动状态和数据

  使用方式：
  ```svelte
  <SwipeablePane
    categories={CATEGORY_OPTIONS}
    currentIndex={categoryIndex}
    onIndexChange={(i) => (categoryIndex = i)}
  >
    {#snippet children(category, index)}
      <WaterfallContainer ... />
    {/snippet}
  </SwipeablePane>
  ```
-->
<script lang="ts">
	import { swipe } from '$lib/modules/gesture';
	import { tick } from 'svelte';
	import type { CategoryOption, SwipeablePaneProps } from './types';

	/** 面板槽位数据结构 */
	type PanelSlot = { category: CategoryOption; originalIndex: number } | null;

	let { categories, currentIndex, children, onIndexChange }: SwipeablePaneProps = $props();

	// ─── 滑动状态 ────────────────────────────────────────────────

	/** 容器元素引用 */
	let containerEl: HTMLElement | undefined = $state();
	/** 容器宽度（px） */
	let containerWidth = $state(0);
	/** 滑动过程中的实时水平偏移（px） */
	let swipeOffset = $state(0);
	/** 是否正在播放过渡动画 */
	let isAnimating = $state(false);
	/** 动画目标偏移量（用于 CSS transition） */
	let animatingOffset = $state(0);

	// ─── 虚拟窗口：只渲染 [prev, current, next] 3 个面板 ─────────

	/**
	 * 常规面板列表：根据 currentIndex 自动计算
	 */
	let normalPanels = $derived.by((): [PanelSlot, PanelSlot, PanelSlot] => {
		const prev: PanelSlot =
			currentIndex > 0
				? { category: categories[currentIndex - 1], originalIndex: currentIndex - 1 }
				: null;
		const current: PanelSlot = { category: categories[currentIndex], originalIndex: currentIndex };
		const next: PanelSlot =
			currentIndex < categories.length - 1
				? { category: categories[currentIndex + 1], originalIndex: currentIndex + 1 }
				: null;
		return [prev, current, next];
	});

	/**
	 * 非相邻跳转时的面板覆盖
	 * 将目标分类临时放入相邻槽位，避免动画过程中露出中间分类的数据
	 */
	let overridePanels = $state<[PanelSlot, PanelSlot, PanelSlot] | null>(null);

	/** 实际用于渲染的面板列表 */
	let panels = $derived(overridePanels ?? normalPanels);

	// ─── 尺寸观测 ────────────────────────────────────────────────

	$effect(() => {
		if (!containerEl) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
			}
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	// ─── Swipe action 配置 ───────────────────────────────────────

	/**
	 * 计算滑动过程中的总偏移
	 * panels[0]=prev 在左侧（-100%），panels[1]=current 在中间（0），panels[2]=next 在右侧（+100%）
	 * swipeOffset > 0 向右拖 → 露出 prev
	 * swipeOffset < 0 向左拖 → 露出 next
	 */
	function getPanelTransform(panelSlot: number): string {
		const baseOffset = (panelSlot - 1) * containerWidth;
		const dragOffset = isAnimating ? animatingOffset : swipeOffset;
		return `translate3d(${baseOffset + dragOffset}px, 0, 0)`;
	}

	let swipeOptions = $derived({
		threshold: 10,
		commitThreshold: 0.25,
		velocityThreshold: 0.3,
		disabled: () => isAnimating,
		onSwipeStart: () => {
			isAnimating = false;
		},
		onSwipeMove: (deltaX: number) => {
			if (currentIndex === 0 && deltaX > 0) {
				swipeOffset = deltaX * 0.3;
			} else if (currentIndex === categories.length - 1 && deltaX < 0) {
				swipeOffset = deltaX * 0.3;
			} else {
				swipeOffset = deltaX;
			}
		},
		onSwipeEnd: (direction: 'left' | 'right') => {
			if (direction === 'right' && currentIndex > 0) {
				animateToIndex(currentIndex - 1);
			} else if (direction === 'left' && currentIndex < categories.length - 1) {
				animateToIndex(currentIndex + 1);
			} else {
				animateCancel();
			}
		},
		onSwipeCancel: () => {
			animateCancel();
		}
	});

	// ─── 动画控制 ────────────────────────────────────────────────

	/**
	 * 播放滑动到相邻索引的动画
	 * 仅用于 |targetIndex - currentIndex| === 1 的情况
	 */
	function animateToIndex(targetIndex: number): void {
		const direction = targetIndex > currentIndex ? -1 : 1;
		isAnimating = true;
		animatingOffset = direction * containerWidth;

		setTimeout(() => {
			swipeOffset = 0;
			animatingOffset = 0;
			isAnimating = false;
			onIndexChange?.(targetIndex);
		}, 300);
	}

	/**
	 * 取消滑动，回弹到当前位置
	 */
	function animateCancel(): void {
		isAnimating = true;
		animatingOffset = 0;

		setTimeout(() => {
			swipeOffset = 0;
			isAnimating = false;
		}, 300);
	}

	/**
	 * 跳转到任意分类（由 Tab 按钮点击触发）
	 *
	 * 相邻跳转：直接滑动动画
	 * 非相邻跳转：
	 *   1. 将目标分类临时放入 next/prev 槽位（overridePanels）
	 *   2. 等待 DOM 更新（tick），确保目标面板已渲染
	 *   3. 播放单步滑动动画
	 *   4. 动画结束后清除 override，更新 currentIndex
	 */
	export async function jumpToIndex(targetIndex: number): Promise<void> {
		if (targetIndex === currentIndex) return;
		if (isAnimating) return;

		if (Math.abs(targetIndex - currentIndex) === 1) {
			animateToIndex(targetIndex);
			return;
		}

		const currentPanel: PanelSlot = {
			category: categories[currentIndex],
			originalIndex: currentIndex
		};
		const targetPanel: PanelSlot = {
			category: categories[targetIndex],
			originalIndex: targetIndex
		};
		const direction = targetIndex > currentIndex ? -1 : 1;

		// 将目标放入相邻槽位：向前跳 → 放 next，向后跳 → 放 prev
		// 保留 normalPanels 中非目标方向的现有 slot，避免 non-null → null 转换
		// 导致 Svelte {#each} 原地更新时在 {#if} 销毁前重新求值 snippet 参数
		if (direction === -1) {
			overridePanels = [normalPanels[0], currentPanel, targetPanel];
		} else {
			overridePanels = [targetPanel, currentPanel, normalPanels[2]];
		}

		// 等待 DOM 渲染目标面板
		await tick();

		isAnimating = true;
		animatingOffset = direction * containerWidth;

		setTimeout(() => {
			swipeOffset = 0;
			animatingOffset = 0;
			isAnimating = false;
			overridePanels = null;
			onIndexChange?.(targetIndex);
		}, 300);
	}
	// ─── 调试 ────────────────────────────────────────────────────

	$effect(() => {
		console.log(
			'[SwipeablePane] panels updated:',
			panels.map((p) => p?.category?.value)
		);
	});
</script>

<div
	class="relative h-full w-full overflow-hidden"
	bind:this={containerEl}
	use:swipe={swipeOptions}
>
	{#each panels as panel, slot (panel?.category?.value)}
		<!-- 始终渲染 wrapper div，防止 Svelte {#each} 原地更新时
		     在 {#if} 销毁前重新求值 snippet 参数导致 null.category 错误 -->
		<div
			class="absolute inset-0"
			class:transition-transform={isAnimating}
			class:duration-300={isAnimating}
			class:ease-in-out={isAnimating}
			style="transform: {getPanelTransform(slot)}; will-change: transform;"
		>
			{#if panel}
				{@render children(panel.category, panel.originalIndex)}
			{/if}
		</div>
	{/each}
</div>
