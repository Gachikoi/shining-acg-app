<!--
  @component SwipeablePane
  可滑动面板容器，管理 3 个面板的"虚拟窗口"。

  核心行为：
  - 始终只维护 3 个槽位，当前不需要渲染的槽位直接置为 null
  - 手势拖动时按当前视口实时重建 panels，并用 WAAPI 让 transform 跟手
  - 非相邻 Tab 点击时，把目标页借位到即将进入视口的一侧，播放单步动画
  - 动画结束后显式定稿，不依赖额外响应式副作用兜底

  使用方式：
  ```svelte
  <SwipeablePane
    categories={CATEGORY_OPTIONS}
    category={selectedCategory}
    onIndexChange={(i) => ...}
  >
    {#snippet children(category, index)}
      <WaterfallContainer ... />
    {/snippet}
  </SwipeablePane>
  ```
-->
<script lang="ts">
	import { shiningBridge } from '$lib/modules/bridge';
	import type { Axis, SwipeState } from '$lib/modules/gesture';
	import { registerScrollBoundary, swipe } from '$lib/modules/gesture';
	import { onMount, untrack } from 'svelte';
	import type { SwipeablePaneProps } from './types';
	import { buildPanels, inspectVisualState, type PanelTuple } from './utils';

	let { categories, currentIndex, currentCategoryId, children, onIndexChange }: SwipeablePaneProps =
		$props();

	// ─── 容器尺寸 ────────────────────────────────────────────────

	/** 容器元素引用（bind:this 在挂载后赋值，仅用于 onMount 内初始化） */
	let containerEl: HTMLElement | undefined;
	/** 容器宽度（px） */
	let containerWidth = $state(0);
	/** 三列槽位根元素（与 `panels` 下标 0/1/2 对齐），[1] 为虚拟窗口 slot1，用于 `contains(pointerup.target)` */
	let panelSlotRoots = $state<(HTMLElement | undefined)[]>([undefined, undefined, undefined]);

	/**
	 * 挂载时：建立 ResizeObserver 监听容器宽度，并注册 scrollBoundary 实现边界让渡。
	 * 卸载时：断开 observer 并 unregister。
	 * 注意！containerEl 是 300% 宽的容器，其 parentElement 是视口，用于注册 scrollBoundary。
	 */
	onMount(() => {
		if (!containerEl?.parentElement) return;

		// 因为 ResizeObserver 执行时机过晚，所以在 onMounted 时先手动获取一次宽度
		containerWidth = containerEl.parentElement.getBoundingClientRect().width; // 和 contentRect.width 一样都是 double 类型
		// 监听 containerWidth 变化并更新元素的 transform translate3d 偏移量
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
				animateTo(0, 0, 0); // 用 animate 而非 style 设定偏移，防止 style 被 animate 覆盖
			}
		});
		observer.observe(containerEl.parentElement);

		// 注册边缘让渡
		const unregister = registerScrollBoundary(containerEl.parentElement, {
			axis: 'x',
			canScroll(queryAxis: Axis, direction: number): boolean {
				if (queryAxis !== 'x') return false;
				// direction > 0: 右滑 → 去上一页，需 windowCenterIndex > 0
				// direction < 0: 左滑 → 去下一页，需未到末项
				if (direction > 0) return currentIndex > 0;
				return currentIndex < categories.length - 1;
			}
		});
		return () => {
			observer.disconnect();
			unregister();
		};
	});

	// ─── 动画 ─────────────────────────────────────────────

	const ANIMATION_DURATION = 300;
	const LIGHT_IMPACT_VIBRATION_OPTION = { type: 'impact', style: 'light' } as const;
	let containerElAnimation: Animation | null = null;
	let queuedJumpTargets = $state<number[]>([]);
	let activeTargetIndex = $state<number | undefined>(undefined);

	/**
	 * 手势/跳转开始时捕获的基础偏移
	 * 在 onMove 中作为基础偏移叠加 deltaX，确保打断动画后拖动从视觉位置无缝衔接。
	 */
	let capturedOffset = 0;

	let panels = $state<PanelTuple>(
		untrack(() => buildPanels(currentIndex, categories, 0, containerWidth))
	);

	// 仅在 categories 变化时重建 panels，并尽量保持用户还能看到原来的 category 分类内容
	$effect(() => {
		void categories;

		untrack(() => {
			const nextIndex =
				categories.findIndex((category) => category.value === currentCategoryId) ?? 0;
			updatePanels(nextIndex);
		});
	});

	// 在 home/+page.svelte 中，如果 snapshot 进行了 restore，则重建 panels
	export const updatePanels = (currentIndex: number) => {
		resetTransitionState(true);
		panels = buildPanels(currentIndex, categories, 0, containerWidth);
		capturedOffset = 0;
		animateTo(0, 0, 0);
	};

	// ─── 偏移钳位 ───────────────────────────────────────────────

	/**
	 * 偏移量钳位（基于 gestureBaseIndex）：
	 * 1. 首/末面板禁止向无内容方向拖动
	 * 2. 限制在 ±containerWidth 范围内（虚拟窗口只有 3 个面板）
	 */
	function clampOffset(raw: number, baseIndex: number): number {
		if (baseIndex === 0 && raw > 0) return 0;
		if (baseIndex === categories.length - 1 && raw < 0) return 0;
		const limit = containerWidth || Infinity;
		return Math.max(-limit, Math.min(limit, raw));
	}

	/**
	 * pointerup 的 `target` 是否落在中间槽 slot1 的根节点子树内（用于决定是否允许「纯速度」翻页）。
	 * slot1 根是 `containerEl` 的子节点，不可能 `contains(containerEl)`，故 target 为手势绑定的整轨容器时不会误判为在 slot1 内。
	 *
	 * @param slot1Root - 中间列（index 1）包裹 `div`
	 * @param target - `SwipeState.endPointerTarget` / `PointerEvent.target`
	 * @returns `target` 为 `Node` 且被 `slot1Root` 包含则为 true
	 */
	function isEndTargetInsideSlot1(
		slot1Root: HTMLElement | undefined,
		target: EventTarget | null | undefined
	): boolean {
		if (!slot1Root || target == null) return false;
		return target instanceof Node && slot1Root.contains(target);
	}

	/**
	 *
	 * @param from 手势开始时捕获的基础偏移，用于动画初始值设定
	 * @param to 偏移量（以 slot 1 为偏移量中心，负数表示向左偏移，正数表示向右偏移）
	 * @param duration 动画时长（ms）
	 * @param baseIndex 当前槽位 1 的面板索引，用于限制偏移量在正确范围内
	 * @returns 动画对象。0ms 即时定位也会返回 animation 实例，但清理由内部完成。
	 */
	const animateTo = (from: number, to: number, duration: number): Animation => {
		if (!containerEl) throw new Error('containerEl 不存在，无法正常运行');

		containerElAnimation?.commitStyles();
		containerElAnimation?.cancel();
		containerElAnimation = null;

		const animation = containerEl.animate(
			[
				{
					transform: `translate3d(${-containerWidth + from}px, 0, 0)`
				},
				{
					transform: `translate3d(${-containerWidth + to}px, 0, 0)`
				}
			],
			{
				duration,
				easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
				fill: 'both' // 不设置 forwards 会闪白屏
			}
		);

		containerElAnimation = animation;

		animation.onfinish = () => {
			animation.commitStyles();
			animation.cancel();
			if (containerElAnimation === animation) {
				containerElAnimation = null;
			}
		};

		return animation;
	};

	/**
	 * 读取容器当前真实 transform 对应的 offset。
	 *
	 * 必须读取 computed style，因为 jump / settle 的位移来自 WAAPI animation，
	 * 只读 inline style 会丢失动画中间帧的位置。
	 *
	 * @returns 当前以 slot 1 为基准的容器偏移量
	 */
	function captureCurrentOffset(): number {
		if (!containerEl) throw new Error('containerEl 不存在，无法正常运行');
		return new DOMMatrix(getComputedStyle(containerEl).transform).m41 + containerWidth;
	}

	/**
	 * 统一取消当前动画状态。
	 *
	 * @param clearQueue - 是否同时清空未执行的 jump 队列
	 * @returns void
	 */
	function resetTransitionState(clearQueue: boolean): void {
		containerElAnimation?.commitStyles();
		containerElAnimation?.cancel();
		containerElAnimation = null;
		activeTargetIndex = undefined;
		if (clearQueue) {
			queuedJumpTargets = [];
		}
	}

	/**
	 * 手势动画完成后的统一定稿。
	 *
	 * @param targetIndex - 本次 settle 最终到达的真实索引
	 * @returns void
	 */
	function finishAnimation(targetIndex: number): void {
		activeTargetIndex = undefined;
		panels = buildPanels(targetIndex, categories, 0, containerWidth);
		capturedOffset = 0;
		animateTo(0, 0, 0);
		containerElAnimation = null;
		pumpJumpQueue();
	}

	/**
	 * 从当前视觉位置启动一段 jump 动画。
	 *
	 * @param targetIndex - 本段 jump 的目标索引
	 * @returns void
	 */
	function startJumpTransition(targetIndex: number): void {
		if (!containerEl) return;

		// 重置动画状态
		resetTransitionState(false);

		// 更新视觉状态
		const visualState = inspectVisualState(
			captureCurrentOffset(),
			panels,
			containerWidth,
			currentIndex
		);
		capturedOffset = visualState.residualOffset;

		activeTargetIndex = targetIndex;
		panels = buildPanels(
			currentIndex,
			categories,
			capturedOffset,
			containerWidth,
			activeTargetIndex
		);

		const targetOffset =
			targetIndex === currentIndex
				? 0
				: targetIndex > currentIndex
					? -containerWidth
					: containerWidth;

		onIndexChange?.(targetIndex);

		requestAnimationFrame(() => {
			if (activeTargetIndex !== targetIndex || containerElAnimation !== null) return;
			animateTo(capturedOffset, targetOffset, ANIMATION_DURATION).onfinish = () => {
				finishAnimation(targetIndex);
			};
		});
	}

	/**
	 * 在 jump 空闲时消费队列里的下一个目标。
	 *
	 * @returns void
	 */
	function pumpJumpQueue(): void {
		if (containerElAnimation !== null) return;
		const [nextTarget, ...rest] = queuedJumpTargets;
		if (nextTarget === undefined) return;
		queuedJumpTargets = rest;
		startJumpTransition(nextTarget);
	}

	// ─── Swipe action 配置 ───────────────────────────────────────

	let swipeOptions = $derived({
		interruptible: true,

		/**
		 * 手势开始：计算视觉基准索引，必要时重建虚拟窗口；并标记手势激活以按需渲染相邻面板。
		 *
		 * 一、之前的方案
		 * resetTransitionState(true);
		 *	capturedOffset = captureCurrentOffset();
		 *	animateTo(capturedOffset, capturedOffset, 0);
		 *
		 * 这种方案有一种缺陷：当上一次 onEnd 在 currentIndex === 2 通过速度触发提交时，会将 panels 改为 "1,2,"，将 currentIndex 改为 1；
		 * 然后用户点击屏幕触发 onStart 并且 visualState.primaryIndex === currentIndex 时，panels 仍为 "1,2,"，captureOffset 按照 1 在第 0 位归位；
		 * 再松手触发 onEnd 时，panels 变为 "0,1,2"，但 inspectVisualState 算 residualOffset 时，依赖的是「当时的 panels + 当时的 offset」。若上一段手势里 panels 还是 "1,2,"，算出来的 residual 是在那一套槽位语义下的「把主屏挪回中间」；
		 * 下一瞬间 panels 已经换成 "0,1,2"，槽位里同一索引对应的列位置变了，之前按 "1,2," 推出来的 residualOffset 和新 panels 不再同一套坐标系，就会出现闪一下的问题。
		 * 二、新的方案
		 * 就是现在的代码，让 矩阵位移、三槽挂载、capturedOffset 三者始终同一套语义
		 */
		onStart: () => {
			if (!containerEl) return;

			resetTransitionState(true);

			const visualState = inspectVisualState(
				captureCurrentOffset(),
				panels,
				containerWidth,
				currentIndex
			);
			if (visualState.primaryIndex !== currentIndex) {
				onIndexChange?.(visualState.primaryIndex);
			}

			/**
			 * 当 onEnd 通过速度触发提交时，会直接触发 currentIndex 的变化：
			 * 假设 onEnd 从 currentIndex===0 根据速度提交到 currentIndex===1，panels 此时为 “,0,1”，这时视觉上的中心面板的 index 不等于 currentIndex；
			 * 然后用户点击屏幕触发 onStart 时，如果 visualState.primaryIndex === currentIndex，
			 * 这里虽然 visualState.primaryIndex === currentIndex，但是由于 panels 变为 "0,1,"，所以 capturedOffset 不等于 visualState.residualOffset，
			 * 所以无论哪种情况，都需要基于最新的 visualState 来归位，而不是使用旧的 captureOffset。
			 */
			capturedOffset = visualState.residualOffset;

			const offset = clampOffset(capturedOffset, currentIndex);
			panels = buildPanels(currentIndex, categories, offset, containerWidth);
			animateTo(offset, offset, 0);

			// 提前唤醒马达
			shiningBridge.prepareForVibrate(LIGHT_IMPACT_VIBRATION_OPTION);
		},

		onMove: (state: SwipeState) => {
			if (!containerEl) return;

			// 获取当前视觉状态，判断是否应该更新 index 和 capturedOffset
			const visualState = inspectVisualState(
				clampOffset(capturedOffset + state.deltaX, currentIndex),
				panels,
				containerWidth,
				currentIndex
			);
			if (visualState.primaryIndex !== currentIndex) {
				onIndexChange?.(visualState.primaryIndex);
				capturedOffset = visualState.residualOffset - state.deltaX;
			}

			const offset = clampOffset(capturedOffset + state.deltaX, currentIndex);
			panels = buildPanels(currentIndex, categories, offset, containerWidth);
			animateTo(offset, offset, 0);
		},

		/**
		 * 手势结束：基于绝对视觉位置决定目标面板（snap-to-nearest）；
		 * 标记手势结束并设置 animatingToward，动画结束后清除。
		 */
		onEnd: (state: SwipeState) => {
			if (!containerEl) return;
			const slot1Root = panelSlotRoots[1];

			// 获取当前视觉状态，判断是否应该更新 index 和 capturedOffset
			const visualState = inspectVisualState(
				clampOffset(capturedOffset + state.deltaX, currentIndex),
				panels,
				containerWidth,
				currentIndex
			);

			let targetIndex = currentIndex;
			capturedOffset = visualState.residualOffset - state.deltaX;

			if (visualState.primaryIndex !== currentIndex) {
				targetIndex = visualState.primaryIndex;
			} else if (
				Math.abs(state.velocityX) > state.velocityThresholdUsed &&
				// 指针通道：仅当 pointerup.target 仍落在中间槽 slot1 子树内才允许「纯速度」翻页
				(state.source !== 'pointer' || isEndTargetInsideSlot1(slot1Root, state.endPointerTarget))
			) {
				// 如果位移没有达到阈值，则判断速度是否达到阈值
				if (state.velocityX < 0 && currentIndex < categories.length - 1) {
					targetIndex = currentIndex + 1;
					shiningBridge.vibrate(LIGHT_IMPACT_VIBRATION_OPTION);
				} else if (state.velocityX > 0 && currentIndex > 0) {
					targetIndex = currentIndex - 1;
					shiningBridge.vibrate(LIGHT_IMPACT_VIBRATION_OPTION);
				} else {
					targetIndex = currentIndex;
				}
			}

			const fromOffset = clampOffset(capturedOffset + state.deltaX, currentIndex);

			const toOffset =
				targetIndex === currentIndex
					? 0
					: targetIndex > currentIndex
						? -containerWidth
						: containerWidth;
			activeTargetIndex = targetIndex;

			panels = buildPanels(currentIndex, categories, fromOffset, containerWidth, targetIndex);

			if (targetIndex !== currentIndex) {
				onIndexChange?.(targetIndex);
			}

			animateTo(fromOffset, toOffset, ANIMATION_DURATION).onfinish = () => {
				finishAnimation(targetIndex);
			};
		}
	});

	// ─── Tab 点击跳转 ────────────────────────────────────────────

	/**
	 * 跳转到任意分类索引（fire-and-forget）
	 *
	 * 从当前视觉位置（而非 gestureBaseIndex 或 currentIndex）出发，
	 * 确保在动画中途点击 Tab 也能从当前视觉位置平滑过渡。
	 */
	export function jumpToIndex(targetIndex: number): void {
		if (!containerEl) throw new Error('containerEl 不存在，无法正常运行');

		if (containerElAnimation !== null) {
			const queueTail = queuedJumpTargets[queuedJumpTargets.length - 1];
			if (activeTargetIndex === targetIndex || queueTail === targetIndex) return;
			queuedJumpTargets = [...queuedJumpTargets, targetIndex];
			shiningBridge.vibrate(LIGHT_IMPACT_VIBRATION_OPTION);
			return;
		}

		startJumpTransition(targetIndex);
		shiningBridge.vibrate(LIGHT_IMPACT_VIBRATION_OPTION);
	}
</script>

<div class="relative h-full w-full overflow-hidden">
	<div
		class="absolute flex h-full w-[300%] touch-none overflow-hidden will-change-transform"
		bind:this={containerEl}
		use:swipe={swipeOptions}
	>
		{#each panels as panel, index (panel?.category?.value || index)}
			<div class="h-full w-1/3" bind:this={panelSlotRoots[index]}>
				{panel?.originalIndex}
				{#if panel}
					{@render children(panel.category, panel.originalIndex)}
				{/if}
			</div>
		{/each}
	</div>
</div>
