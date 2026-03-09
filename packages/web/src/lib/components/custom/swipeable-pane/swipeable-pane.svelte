<!--
  @component SwipeablePane
  可滑动面板容器，管理 3 个面板的"虚拟窗口"。

  核心行为：
  - 始终只渲染最多 3 个面板（prev / current / next），按需创建/销毁
  - 手势/wheel 滑动时实时预览相邻面板，松手后 Spring 弹性过渡
  - 非相邻 Tab 点击时，将目标分类临时放入相邻槽位，播放单步 Spring 动画
  - 每个面板独立管理滚动状态和数据

  动画策略：
  - 所有位移由 Spring<number> 驱动，通过 Svelte 响应式绑定到 style:transform
  - 拖动阶段 spring.set(value, { instant: true }) 即时跟手
  - 松手后 spring.set(target) 启动物理弹性动画（fire-and-forget，不 await）
  - $effect 监听 offsetSpring.current 实现近距定稿（1px 阈值），
    避免 Spring 尾端渐近收敛导致的长 await（锁 arena 阻塞 pullRefresh 等其他手势）

  手势打断策略：
  - onStart 计算离视口中心最近的面板作为 gestureBaseIndex
  - 如果 gestureBaseIndex !== currentIndex，立即重建虚拟窗口（overridePanels）
    并调整 offset 保持视觉连续，使新手势可到达 gestureBaseIndex ± 1
  - onEnd 以 containerWidth/2 为「snap to nearest」阈值（位置），
    辅以速度检查（velocity flick）决定最终面板

  使用方式：
  ```svelte
  <SwipeablePane
    categories={CATEGORY_OPTIONS}
    currentIndex={categoryIndex}
    onCommit={(i) => ...}
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
	import { Spring } from 'svelte/motion';
	import type { CategoryOption, SwipeablePaneProps } from './types';
	import type { SwipeState } from '$lib/modules/gesture';

	/** 面板槽位数据结构 */
	type PanelSlot = { category: CategoryOption; originalIndex: number } | null;

	let { categories, currentIndex, children, onCommit, onIndexChange }: SwipeablePaneProps =
		$props();

	// ─── 容器尺寸 ────────────────────────────────────────────────

	/** 容器元素引用 */
	let containerEl: HTMLElement | undefined = $state();
	/** 容器宽度（px） */
	let containerWidth = $state(0);

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

	// ─── Spring 偏移 ─────────────────────────────────────────────

	/** 所有面板的统一水平偏移，由 swipe 手势和 Spring 动画驱动 */
	const offsetSpring = new Spring(0, { stiffness: 0.15, damping: 0.9 });

	// ─── 动画纪元（打断保护） ────────────────────────────────────

	/**
	 * 每次新手势或跳转开始时自增。
	 * $effect 定稿时对比纪元，被打断的动画不会执行副作用。
	 */
	let animEpoch = 0;

	/**
	 * 手势开始时捕获的 Spring 当前值（经过视觉索引调整后的残差偏移）。
	 * 在 onMove 中作为基础偏移叠加 deltaX，确保打断动画后拖动从视觉位置无缝衔接。
	 */
	let capturedOffset = 0;

	/** jumpToIndex 正在进行中标志，仅用于描述当前状态，不再阻止新的 jump */
	let isJumping = false;

	// ─── 手势基准索引 ────────────────────────────────────────────

	/**
	 * 手势计算的基准索引——当前「视觉中心」所在的面板。
	 *
	 * 当手势打断动画时，通过 Spring 偏移计算离屏幕中心最近的面板索引并赋值。
	 * clampOffset、onEnd 的提交评估、jumpToIndex 均基于此值，
	 * 而非 prop currentIndex（可能因 Svelte 批处理延迟尚未更新）。
	 *
	 * 空闲时（无动画、无覆盖面板、无跳转）通过 $effect 与 currentIndex 同步。
	 */
	let gestureBaseIndex = $state(0);

	/** 空闲时与 prop currentIndex 同步 */
	$effect(() => {
		if (!animTarget && !overridePanels && !isJumping) {
			gestureBaseIndex = currentIndex;
		}
	});

	// ─── 动画目标 & $effect 近距定稿 ─────────────────────────────

	/**
	 * 当前动画的目标状态。
	 *
	 * 设置后，下方 $effect 会在每帧追踪 offsetSpring.current，
	 * 当 Spring 距目标 < 1px 时自动执行定稿（重置 Spring、更新 currentIndex）。
	 *
	 * 始终设置（包含回弹），确保 overridePanels 在动画结束后被清理。
	 * null 仅表示完全空闲。
	 */
	let animTarget: { offset: number; targetIndex: number; epoch: number } | null = $state(null);

	/**
	 * Spring 近距定稿 $effect
	 *
	 * 响应式追踪机制：
	 * - animTarget 为 null 时：不读取 offsetSpring.current → 零开销
	 * - animTarget 有值时：每帧追踪 offsetSpring.current → 在目标 1px 内自动定稿
	 *
	 * 定稿执行：
	 * 1. 清除 animTarget
	 * 2. 校验 epoch（被打断则跳过）
	 * 3. 更新 gestureBaseIndex
	 * 4. 重置 Spring 到 0
	 * 5. 清理 overridePanels / isJumping
	 * 6. 通知外部 onIndexChange
	 */
	$effect(() => {
		if (!animTarget) return;
		const dist = Math.abs(offsetSpring.current - animTarget.offset);
		if (dist < 1) {
			const { targetIndex, epoch } = animTarget;
			animTarget = null;
			if (epoch !== animEpoch) return;
			gestureBaseIndex = targetIndex;
			offsetSpring.set(0, { instant: true });
			overridePanels = null;
			isJumping = false;
			onIndexChange?.(targetIndex);
		}
	});

	// ─── 虚拟窗口 ───────────────────────────────────────────────

	/** 常规面板列表：根据 currentIndex（prop）自动计算 */
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

	/** 非相邻跳转 / 手势打断时的面板覆盖 */
	let overridePanels = $state<[PanelSlot, PanelSlot, PanelSlot] | null>(null);

	/** 实际用于渲染的面板列表 */
	let panels = $derived(overridePanels ?? normalPanels);

	/**
	 * 构建以 centerIndex 为中心的三面板虚拟窗口
	 *
	 * @param centerIndex - 中心面板索引
	 * @returns [prev, current, next] 三元组
	 */
	function buildPanels(centerIndex: number): [PanelSlot, PanelSlot, PanelSlot] {
		const prev: PanelSlot =
			centerIndex > 0
				? { category: categories[centerIndex - 1], originalIndex: centerIndex - 1 }
				: null;
		const current: PanelSlot = {
			category: categories[centerIndex],
			originalIndex: centerIndex
		};
		const next: PanelSlot =
			centerIndex < categories.length - 1
				? { category: categories[centerIndex + 1], originalIndex: centerIndex + 1 }
				: null;
		return [prev, current, next];
	}

	/**
	 * 计算当前视觉状态。
	 *
	 * 该函数不依赖 `currentIndex` 或 `gestureBaseIndex` 的同步时机，
	 * 而是直接根据当前实际渲染的 `panels` 槽位和 `offsetSpring.current`
	 * 反推「离视口中心最近的面板」。
	 *
	 * 这样在以下场景中都能得到稳定结果：
	 * - 手势打断 Spring 动画
	 * - 非相邻 jump 动画进行到一半时再次点击其他 Tab
	 * - overridePanels 临时替换了标准三窗口结构
	 *
	 * @returns 当前视觉中心对应的索引、槽位、容器宽度与残差偏移
	 */
	function getVisualState(): {
		visualIndex: number;
		visualSlot: number;
		containerWidth: number;
		residualOffset: number;
	} {
		const width = containerWidth || 1;
		const currentOffset = offsetSpring.current;

		/**
		 * 默认回退到中心槽位。
		 * 正常情况下中心槽位总会存在，但这里保留兜底分支，避免极端状态下返回非法值。
		 */
		let visualIndex = currentIndex;
		let visualSlot = 1;
		let minDistance = Infinity;

		for (let slot = 0; slot < panels.length; slot++) {
			const panel = panels[slot];
			if (!panel) continue;

			/**
			 * 面板当前位置 = 槽位基准位移 + 全局 Spring 偏移。
			 * 离 0 最近的面板，就是当前视觉中心所在页。
			 */
			const panelTranslateX = (slot - 1) * width + currentOffset;
			const distanceToCenter = Math.abs(panelTranslateX);

			if (distanceToCenter < minDistance) {
				minDistance = distanceToCenter;
				visualIndex = panel.originalIndex;
				visualSlot = slot;
			}
		}

		/**
		 * residualOffset 表示：
		 * 若把当前视觉中心页重新放回中心槽位（slot = 1），
		 * 为保持视觉位置不变，Spring 需要立刻设置成多少。
		 */
		const residualOffset = (visualSlot - 1) * width + currentOffset;

		return {
			visualIndex,
			visualSlot,
			containerWidth: width,
			residualOffset
		};
	}

	// ─── 偏移钳位 ───────────────────────────────────────────────

	/**
	 * 偏移量钳位（基于 gestureBaseIndex）：
	 * 1. 首/末面板禁止向无内容方向拖动
	 * 2. 限制在 ±containerWidth 范围内（虚拟窗口只有 3 个面板）
	 *
	 * @param raw - 原始偏移量
	 * @returns 钳位后的偏移量
	 */
	function clampOffset(raw: number): number {
		if (gestureBaseIndex === 0 && raw > 0) return 0;
		if (gestureBaseIndex === categories.length - 1 && raw < 0) return 0;
		const limit = containerWidth || Infinity;
		return Math.max(-limit, Math.min(limit, raw));
	}

	// ─── Swipe action 配置 ───────────────────────────────────────

	/** 速度阈值（px/ms）：快速轻扫提交 */
	const VELOCITY_MIN = 0.3;

	let swipeOptions = $derived({
		threshold: 10,
		interruptible: true,

		/**
		 * 手势开始：计算视觉基准索引，必要时重建虚拟窗口。
		 *
		 * 核心逻辑：
		 * 1. 通过 Spring 当前偏移计算离屏幕中心最近的面板 → visualIndex
		 * 2. 如果 visualIndex ≠ currentIndex（手势打断了动画）：
		 *    - 重建虚拟窗口（overridePanels）以 visualIndex 为中心
		 *    - 计算残差偏移（residual）保持视觉连续
		 *    - 通知 parent 更新 currentCategoryId 和 categoryIndex
		 * 3. 后续 onMove/onEnd 基于 gestureBaseIndex 而非 currentIndex
		 */
		onStart: () => {
			animEpoch++;
			animTarget = null;

			const { visualIndex, residualOffset } = getVisualState();

			gestureBaseIndex = visualIndex;

			if (visualIndex !== currentIndex) {
				capturedOffset = residualOffset;
				offsetSpring.set(residualOffset, { instant: true });
				overridePanels = buildPanels(visualIndex);
				onCommit?.(visualIndex);
				onIndexChange?.(visualIndex);
			} else {
				capturedOffset = residualOffset;
				offsetSpring.set(residualOffset, { instant: true });
			}
		},

		onMove: (state: SwipeState) => {
			const raw = capturedOffset + state.deltaX;
			offsetSpring.set(clampOffset(raw), { instant: true });
		},

		/**
		 * 手势结束：基于绝对视觉位置决定目标面板（snap-to-nearest）。
		 *
		 * 提交评估基于 gestureBaseIndex 而非 currentIndex：
		 * - 位置阈值：|finalOffset| > containerWidth/2 → 离相邻面板更近 → 切换
		 * - 速度阈值：finalOffset 在目标侧且速度方向一致 → 快速轻扫切换
		 * - 否则：回弹到 gestureBaseIndex
		 *
		 * 始终设置 animTarget（含回弹），确保 overridePanels 在动画结束后被清理。
		 *
		 * @param state - 手势结束时的状态快照
		 */
		onEnd: (state: SwipeState) => {
			const finalOffset = clampOffset(capturedOffset + state.deltaX);
			let targetIndex = gestureBaseIndex;
			const halfWidth = containerWidth / 2;

			/**
			 * snap-to-nearest 提交评估：
			 *
			 * velocityX 符号约定（来自 VelocityTracker，基于 clientX）：
			 * - 正值 = 手指向右 = offset 正方向 = prev 面板方向
			 * - 负值 = 手指向左 = offset 负方向 = next 面板方向
			 */
			const goNext =
				gestureBaseIndex < categories.length - 1 &&
				finalOffset < 0 &&
				(Math.abs(finalOffset) > halfWidth ||
					(state.velocityX < 0 && Math.abs(state.velocityX) > VELOCITY_MIN));

			const goPrev =
				gestureBaseIndex > 0 &&
				finalOffset > 0 &&
				(Math.abs(finalOffset) > halfWidth ||
					(state.velocityX > 0 && Math.abs(state.velocityX) > VELOCITY_MIN));

			if (goNext) targetIndex = gestureBaseIndex + 1;
			else if (goPrev) targetIndex = gestureBaseIndex - 1;

			if (targetIndex !== gestureBaseIndex) {
				onCommit?.(targetIndex);
			}

			const dir = targetIndex > gestureBaseIndex ? -1 : targetIndex < gestureBaseIndex ? 1 : 0;
			const targetOffset = dir * containerWidth;
			offsetSpring.set(targetOffset);
			animTarget = { offset: targetOffset, targetIndex, epoch: animEpoch };
		}
	});

	// ─── Tab 点击跳转 ────────────────────────────────────────────

	/**
	 * 跳转到任意分类索引（fire-and-forget）
	 *
	 * 从当前视觉位置（而非 gestureBaseIndex 或 currentIndex）出发，
	 * 确保在动画中途点击 Tab 也能从当前视觉位置平滑过渡。
	 *
	 * 流程：
	 * 1. 通过 Spring 偏移计算当前视觉索引 + 残差偏移
	 * 2. 以视觉索引为中心重建虚拟窗口
	 * 3. offsetSpring 设为残差偏移（保持视觉连续）
	 * 4. rAF 后启动 Spring 动画到 targetOffset
	 * 5. $effect 近距定稿
	 *
	 * @param targetIndex - 目标分类索引
	 * @returns 无返回值
	 */
	export function jumpToIndex(targetIndex: number): void {
		const { visualIndex, containerWidth: width, residualOffset } = getVisualState();

		isJumping = true;
		animEpoch++;
		animTarget = null;
		const epoch = animEpoch;

		/**
		 * 将 gestureBaseIndex 立即同步到当前视觉中心页。
		 * 这样如果这次 jump 又被新的手势或 jump 打断，新的计算基线仍然正确。
		 */
		gestureBaseIndex = visualIndex;

		/**
		 * 先把当前视觉中心页放回中心槽位，保持视觉连续。
		 * 后续无论是相邻跳转还是非相邻跳转，都从这份统一基线开始。
		 */
		offsetSpring.set(residualOffset, { instant: true });

		/**
		 * 命中当前视觉中心页时，不再忽略点击，而是直接把该页收束到中心。
		 * 这样动画中途再次点击当前正在靠近中心的目标页，也能立即完成对齐。
		 */
		if (targetIndex === visualIndex) {
			overridePanels = buildPanels(visualIndex);
			onCommit?.(targetIndex);
			offsetSpring.set(0);
			animTarget = { offset: 0, targetIndex, epoch };
			return;
		}

		onCommit?.(targetIndex);

		const direction = targetIndex > visualIndex ? -1 : 1;
		const targetOffset = direction * width;

		// 重建虚拟窗口：visualIndex 在中心槽位
		if (Math.abs(targetIndex - visualIndex) === 1) {
			overridePanels = buildPanels(visualIndex);
		} else {
			// 非相邻跳转：将目标放入相邻槽位
			const fromPanel: PanelSlot = {
				category: categories[visualIndex],
				originalIndex: visualIndex
			};
			const targetPanel: PanelSlot = {
				category: categories[targetIndex],
				originalIndex: targetIndex
			};
			const basePanels = buildPanels(visualIndex);
			if (direction === -1) {
				overridePanels = [basePanels[0], fromPanel, targetPanel];
			} else {
				overridePanels = [targetPanel, fromPanel, basePanels[2]];
			}
		}

		// 等待 Svelte DOM 更新后启动动画
		requestAnimationFrame(() => {
			if (epoch !== animEpoch) {
				return;
			}
			offsetSpring.set(targetOffset);
			animTarget = { offset: targetOffset, targetIndex, epoch };
		});
	}
</script>

<div
	class="relative h-full w-full overflow-hidden"
	style="touch-action: pan-y;"
	bind:this={containerEl}
	use:swipe={swipeOptions}
>
	{#each panels as panel, slot (panel?.category?.value)}
		<div
			class="absolute inset-0 overflow-hidden"
			style="transform: translate3d({(slot - 1) * containerWidth +
				offsetSpring.current}px, 0, 0); will-change: transform; contain: strict;"
		>
			{#if panel}
				{@render children(panel.category, panel.originalIndex)}
			{/if}
		</div>
	{/each}
</div>
