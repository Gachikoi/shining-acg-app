<!--
  @component StackItem
  堆叠布局的单个页面包装器，负责：
  - 全屏定位（position: fixed; inset: 0）
  - 进栈动画：从右侧屏幕外弹入（Spring 物理动画）
  - 右滑手势：拖动跟手 → 提交后弹出屏幕右侧 → popById 出栈
  - 左滑手势：拖动跟手 → 提交后弹回原位 → 触发 onLeftSwipe 回调
  - 懒加载态：item.component 为 null 时显示全屏居中 spinner，
    loader resolve 后（$derived 响应式）自动渲染真实组件
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { swipe } from '$lib/modules/gesture';
	import stackController from './stack.svelte';
	import type { StackItem } from './types';

	// ─── Props ──────────────────────────────────────────────────────

	/** StackItem 内部组件属性 */
	interface Props {
		/** 当前要渲染的栈元素 */
		item: StackItem;
		/** 该层的 CSS z-index */
		zIndex: number;
		/** 是否正在动画中 */
		_isAnimating: boolean;
		/**
		 * 向左滑动（自定义操作）触发的回调
		 * 回弹动画完成后调用，不触发出栈
		 *
		 * @param item - 触发手势的栈元素
		 */
		onLeftSwipe?: () => void;
	}

	let { item, zIndex, _isAnimating = $bindable(), onLeftSwipe }: Props = $props();

	// ─── DOM 引用 ────────────────────────────────────────────────────

	/** 容器元素引用 */
	let el: HTMLElement | undefined = $state();

	// ─── Spring 动画 ─────────────────────────────────────────────────
	const xSpring = new Spring(0, { stiffness: 0.2, damping: 0.85 });

	// ─── 进栈动画 ────────────────────────────────────────────────────

	onMount(async () => {
		// 先跳到屏幕右侧外（无动画），再用 Spring 弹入到 0
		xSpring.set(window.innerWidth, { instant: true });
		_isAnimating = true;
		await xSpring.set(0);
		_isAnimating = false;
	});

	// ─── 手势配置 ────────────────────────────────────────────────────

	/**
	 * swipe action 的动态配置
	 *
	 * 使用 $derived 确保 item / onLeftSwipe props 变化时 swipe action 能获取最新引用。
	 * disabled 以函数形式读取 _isAnimating（非 $state），闭包实时取值保证正确性。
	 *
	 * onSwipeEnd / onSwipeCancel 为 async 函数：
	 * swipe action 调用时忽略返回的 Promise，异步执行在后台继续，
	 * _isAnimating 标志位防止动画未完成时触发新手势。
	 */
	const swipeOptions = $derived({
		threshold: 10,
		commitThreshold: 0.3,
		velocityThreshold: 0.3,
		/** 动画期间禁止新手势，防止与进栈/出栈动画冲突 */
		disabled: () => _isAnimating,
		onSwipeMove: (deltaX: number) => {
			// 没有 onLeftSwipe 禁止左滑
			if ((onLeftSwipe && deltaX < 0) || deltaX > 0) {
				xSpring.set(deltaX, { instant: true });
			}
		},
		onSwipeEnd: async (direction: 'left' | 'right') => {
			_isAnimating = true;
			if (direction === 'right') {
				// ── 右滑提交：弹出屏幕右侧、
				// 使用元素实际宽度确保完全离开视口
				const exitX = el?.clientWidth ?? window.innerWidth;
				console.time('xSpring.set');
				await xSpring.set(exitX);
				_isAnimating = false;
				console.timeEnd('xSpring.set');
				stackController.popById(item.id);
			} else {
				// ── 左滑提交：弹回原位 → 触发自定义回调（不出栈）────────
				// await xSpring.set(0);
				// onLeftSwipe?.(item);
			}
		},
		onSwipeCancel: async () => {
			// 未达到触发阈值：弹回原位
			_isAnimating = true;
			await xSpring.set(0);
			_isAnimating = false;
		}
	});

	const DynamicComponent = $derived(item.component);
</script>

<!--
  全屏覆盖层
  - position: fixed; inset: 0 脱离文档流，覆盖整个视口
-->
<div
	bind:this={el}
	style:z-index={zIndex}
	style:will-change="transform"
	style:transform={`translate3d(${xSpring.current}px, 0, 0)`}
	class="fixed inset-0 top-[env(safe-area-inset-top)] bg-background"
	use:swipe={swipeOptions}
>
	{#if DynamicComponent}
		<!-- 组件已就绪（静态 push 或懒加载 resolve 后） -->
		<DynamicComponent {...item.props} />
	{:else}
		<!-- 懒加载进行中：全屏居中 spinner，进栈动画与加载同步进行 -->
		<div class="flex h-full w-full items-center justify-center">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60"
			></div>
		</div>
	{/if}
</div>
