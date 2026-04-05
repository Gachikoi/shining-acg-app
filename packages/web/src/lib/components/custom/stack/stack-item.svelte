<!--
  @component StackItem
  堆叠布局的单个页面包装器，负责：
  - 全屏定位（position: fixed; inset: 0）
  - 进栈动画：从右侧屏幕外弹入（Spring 物理动画）
  - 右滑手势：拖动跟手 → 提交后弹出屏幕右侧 → popById 出栈
  - 左滑手势：拖动跟手 → 提交后弹回原位 → 触发 onLeftSwipe 回调
  - 懒加载态：item.component 为 null 时在 `el` 内 `mount` CommandLoadingHost（`Loading.show({ target: el })`），
    loader resolve 后 `hide` 并渲染真实组件
-->
<script module lang="ts">
	/**
	 * StackItem DOM 快照（模块级单例）
	 *
	 * 用于 maxVisible 裁剪导致的卸载/再挂载场景：
	 * - 卸载时保存当前行内样式
	 * - 再挂载时按 item.id 恢复上一次视觉状态
	 */
	type CachedDomSnapshot = {
		transform: string;
		clipPath: string;
		transition: string;
	};

	const domSnapshotByItemId = new Map<string, CachedDomSnapshot>();

	/**
	 * @param itemId - 栈元素 id
	 * @returns 对应缓存快照（不存在则 undefined）
	 */
	export function getDomSnapshot(itemId: string): CachedDomSnapshot | undefined {
		return domSnapshotByItemId.get(itemId);
	}

	/**
	 * @param itemId - 栈元素 id
	 * @param snapshot - 要写入的 DOM 快照
	 * @returns void
	 */
	export function setDomSnapshot(itemId: string, snapshot: CachedDomSnapshot): void {
		domSnapshotByItemId.set(itemId, snapshot);
	}
</script>

<script lang="ts">
	import type { SwipeOptions, SwipeState } from '$lib/modules/gesture';
	import { edgeZone, swipe } from '$lib/modules/gesture';
	import { onDestroy, onMount, type SvelteComponent, untrack } from 'svelte';
	import { Loading } from '../command-loading';
	import stackController from './stack.svelte';
	import type { StackItem, StackPageLifecycleStatus } from './types';

	let {
		item,
		zIndex,
		_isAnimating = $bindable()
	}: {
		/** 当前要渲染的栈元素 */
		item: StackItem;
		/** 该层的 CSS z-index */
		zIndex: number;
		/** 是否正在动画中 */
		_isAnimating?: boolean;
	} = $props();

	/**
	 * $props 衍生值
	 */
	let isNext = $derived(item.isNext ?? false); // 自己是不是左滑入栈的那个元素
	let hasNext = $derived(item.next !== undefined); // 自己后方还有没有左滑入栈的元素
	let isTop = $derived(item.id === stackController.top?.id); // 自己是不是栈顶
	let isSecondaryTop = $derived(
		stackController.length >= 2 && item.id === stackController.items[stackController.length - 2]?.id
	); // 自己是不是第二层栈顶

	/** 动画 */
	const EASING = 'cubic-bezier(0.45, 0, 0.55, 1)';
	const DURATION = 300;

	/**
	 * `moveAndScaleTo` 使用的复合 transition：transform 与 clip-path 使用相同的 duration / easing。
	 * 逗号分隔多条过渡是 CSS transition 简写的标准写法（与分别写 transition-property 等价）。
	 */
	const TRANSFORM_AND_CLIP_TRANSITION = `transform ${DURATION}ms ${EASING}, clip-path ${DURATION}ms ${EASING}`;

	// 组件引用
	const DynamicComponent = $derived(item.component);

	/** 容器元素引用 */
	let el: HTMLElement | null = $state(null);
	let componentEl: SvelteComponent | null = $state(null);

	/**
	 * 是否处于「右滑 scale-down」状态
	 *
	 * - true：scale 从 1 缩小（swipe-right 手势或取消后的回弹），使用 origin-center
	 * - false：push 从 rectInfo 弹入、pop 回到 rectInfo，使用 origin-top-left
	 */
	let isSwipeRightScaleDown = $state(false);

	/** 初始化位置和缩放 */
	let initTranslateX = 0;
	let initTranslateY = 0;
	let initScale = 1;

	/** 暴露子组件的查询页面状态函数给 stack-container 使用 */
	export const queryStatus = (): StackPageLifecycleStatus => {
		return componentEl?.queryStatus?.() ?? 'silence';
	};

	/**
	 * 等待写在 `el` **自身**上的 CSS transition 全部结束。
	 *
	 * 仅用 `transitionend` 时：子节点 transition 会冒泡到 `el` 导致误 resolve；更糟的是当起止状态无实际插值时
	 * 某些引擎不派发 `transitionend`，Promise 永久挂起（与本次 onEnd 后无法滑动一致）。
	 * Web Animations 的 `getAnimations({ subtree: false })` + `finished` 与「是否产生过渡」一致。
	 *
	 * 双 `requestAnimationFrame`：保证样式已提交且 UA 已为本元素登记 transition（单帧内可能仍为空）。
	 *
	 * @param el - 已写入 `transition` / `transform` / `clipPath` 的容器
	 * @returns transition 结束或确认未产生过渡时 resolve
	 */
	function waitForOwnCssTransitions(el: HTMLElement): Promise<void> {
		return new Promise((resolve) => {
			const finish = () => {
				el.style.transition = 'none';
				resolve();
			};
			// 第一个 rAf 在 dom 渲染前执行，这时 transition 还没有影响到 dom, el.getAnimations 可能取不到动画，所以用双 rAF
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					const anims = el.getAnimations({ subtree: false });
					if (anims.length === 0) {
						finish();
						return;
					}
					void Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {
						finish();
					});
				});
			});
		});
	}

	/**
	 * 将当前层水平平移到指定 translateX。
	 *
	 * @param x - 目标 translateX（px）
	 * @param withAnimation - true 时在 transition 结束后 resolve；false 为同步更新样式
	 * @param needClamp - true 时在水平移出左缘时钳在 0，在手势驱动的 pan 时需要设置为 true；在动画驱动的 pan 时需要设置为 false，因为动画驱动时，可能位移到超出左缘。
	 * @returns 无动画时为 void；有动画时为在过渡完成时 resolve 的 Promise
	 */
	const panTo = ((
		x: number,
		{ withAnimation, needClamp = true }: { withAnimation: boolean; needClamp?: boolean }
	): void | Promise<void> => {
		/** 无 next 时不允许水平移出左缘；负位移改为钳在 0，避免整帧不写字样导致跟手卡住 */
		const tx = !hasNext && needClamp ? Math.max(0, x) : x;

		el!.style.transition = withAnimation ? `transform ${DURATION}ms ${EASING}` : 'none';
		el!.style.transform = `translate3d(${tx}px, 0, 0)`;
		el!.style.clipPath = '';

		if (!withAnimation) return;

		return waitForOwnCssTransitions(el!);
	}) as {
		(x: number, options: { withAnimation: true; needClamp?: boolean }): Promise<void>;
		(x: number, options: { withAnimation: false; needClamp?: boolean }): void;
	};

	// 这些数据都是随着容器尺寸变化而变化的，所以其实不需要 pxToRem 辅助函数
	const moveAndScaleTo = ((
		x: number,
		y: number,
		scale: number,
		withAnimation: boolean
	): void | Promise<void> => {
		/** 与 panTo 一致：无 hasNext 时 translateX 不越过 0，否则负位移时早退会导致本帧不写 transform */
		const tx = !hasNext && !isSwipeRightScaleDown ? Math.max(0, x) : x;
		const tScale = Math.min(1, scale);
		const ty = x > 0 || isSwipeRightScaleDown ? y : 0;

		const clipHalfRem = calcClipHeight(tScale) / 2;
		const nextClipPath = `inset(${clipHalfRem}px 0 ${clipHalfRem}px 0 ${clipHalfRem > 0 || isSwipeRightScaleDown ? 'round var(--radius-xl)' : ''})`;

		el!.style.transition = withAnimation ? TRANSFORM_AND_CLIP_TRANSITION : 'none';
		el!.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale3d(${tScale}, ${tScale}, 1)`;
		/**
		 * - 有裁切时在 inset() 会覆盖掉 rounded-xl 的圆角，所以需要手动添加 round var(--radius-xl)
		 */
		el!.style.clipPath = nextClipPath;

		if (!withAnimation) return;

		return waitForOwnCssTransitions(el!);
	}) as {
		(x: number, y: number, scale: number, withAnimation: true): Promise<void>;
		(x: number, y: number, scale: number, withAnimation: false): void;
	};

	/**
	 * 根据 scale 动态计算的裁切高度（总裁切量，上下各半）
	 *
	 * 满足：
	 * 1. scale 变大时 clip 负相关地减小，变化连续
	 * 2. 两端：scale=1 时 clip=0；scale=initScale 时 clip=(el!.clientHeight*scale - rectInfo.height)/scale
	 *
	 * 线性插值连接两端：clip = maxClip * (1 - scale) / (1 - initScale)
	 */
	const calcClipHeight = (scale: number) => {
		if (!el || !item.rectInfo) return 0;

		if (scale >= 1) return 0;
		if (initScale >= 1) return 0;

		// scale=initScale 时的 clip 值（用户指定的公式）
		const maxClip = (el!.clientHeight * initScale - item.rectInfo.height) / initScale;
		if (maxClip <= 0) return 0;

		if (scale <= initScale) return Math.max(0, maxClip);

		// 线性插值：scale 从 originScaleSpring→1 时 clip 从 maxClip→0
		const clip = (maxClip * (1 - scale)) / (1 - initScale);
		return Math.max(0, clip);
	};

	/**
	 * 动态 transform-origin：
	 * - push（rectInfo 弹入）/ pop（回到 rectInfo）：origin-top-left，scale 从触点展开
	 * - swipe-right（从全屏缩小）：origin-center，营造中心收缩的视觉效果
	 * - 最终回到 scale=1、translate=0 时，位置正确（与 origin 无关）
	 */
	const transformOrigin = $derived(isSwipeRightScaleDown ? 'center' : 'top left');

	// ─── 手势配置 ────────────────────────────────────────────────────

	/**
	 * swipe action 的动态配置
	 *
	 * 使用 $derived 确保 item / onLeftSwipe props 变化时 swipe action 能获取最新引用。
	 * disabled 以函数形式读取 _isAnimating，闭包实时取值保证正确性。
	 */
	const swipeOptions: SwipeOptions = $derived({
		disabled: () => _isAnimating ?? false, // 利用 onEnd 返回 Promise 禁用动画打断，只能禁用某个手势实例的动画。但 stack-item 只要有一个 item 在动画中，其他 stack-item 的 swipe 手势都应该被禁用。
		onMove: async (state: SwipeState) => {
			_isAnimating = true;

			if (state.deltaX < 0 && isTop && hasNext && !stackController.isPushingNext) {
				// 左滑：创建 next 入栈
				await stackController.pushNext();
				// 先设置 isPushingNext 为 true，防止在设置 swipeState 的值引发 $effect 响应式，还使用的是旧值
				stackController.setIsPushingNext(true);
			}

			// 写入 swipeState，所有 StackItem 通过 $effect 响应式同步动画
			stackController.setSwipeState({ ...state, type: 'onMove' });

			if (isTop && item.rectInfo) {
				if (state.deltaX > 0) {
					isSwipeRightScaleDown = true;
				}
				moveAndScaleTo(
					state.deltaX,
					state.deltaY,
					1 - (0.2 * state.deltaX) / el!.clientWidth,
					false
				);
			} else if (isTop && !item.rectInfo) {
				panTo(state.deltaX, { withAnimation: false });
			} else if (isSecondaryTop && hasNext && stackController.isPushingNext) {
				panTo(state.deltaX * 0.5, { withAnimation: false });
			}

			_isAnimating = false;
		},

		onEnd: async (state: SwipeState) => {
			_isAnimating = true;

			stackController.setSwipeState({ ...state, type: 'onEnd' });

			if (isTop && item.rectInfo) {
				isSwipeRightScaleDown = false;
				if (state.direction === 'right' && state.committed) {
					await moveAndScaleTo(initTranslateX, initTranslateY, initScale, true);
					stackController.pop(false);
				} else {
					await moveAndScaleTo(0, 0, 1, true);
				}
			} else if (isTop && !item.rectInfo) {
				if (state.direction === 'right' && state.committed) {
					await panTo(el!.clientWidth, { withAnimation: true });
					stackController.pop(false);
				} else {
					await panTo(0, { withAnimation: true });
				}
			} else if (isSecondaryTop && hasNext && stackController.isPushingNext) {
				if (state.direction === 'left' && state.committed) {
					await panTo(-(el!.clientWidth / 2), { withAnimation: true });
				} else {
					await panTo(0, { withAnimation: true });
					stackController.pop(false); // 左滑时，第二栈顶放弃提交，把第一栈顶（即刚才 onMove 中 pushNext 的元素）弹出
				}
				stackController.setIsPushingNext(false);
			}

			stackController.setSwipeState(null);

			_isAnimating = false;
		}
	});

	/**
	 * 执行 pop 动画（由 animationPhase === 'pop' 触发）
	 * 栈顶：缩放到 rectInfo 或滑出右侧；第二层：滑回中心
	 *
	 * @description
	 * 提交 `pop(false)` 时必须使用**动画开始时**的栈顶 id，不能用 `await` 之后的 `isTop`：
	 * 栈顶先完成动画并出栈后，原第二层在异步结束时 `isTop` 会变为 true，若据此再 pop 会多弹一层。
	 */
	const runPopAnimation = async () => {
		/** 本帧 phase=pop 时全局栈顶 id；仅该层负责 commitPop（与结束时 derived 的 isTop 无关） */
		const shouldCommitPop = $state.snapshot(isTop); // 必须在实际进行 pop 前记录 top?.id，否则可能因为并发导致多次 pop（多次判断 top?.id === item.id)

		_isAnimating = true;

		if (item.rectInfo && isTop) {
			await moveAndScaleTo(initTranslateX, initTranslateY, initScale, true);
		} else if (!item.rectInfo && isTop) {
			await panTo(el!.clientWidth, { withAnimation: true, needClamp: false });
		} else if (isSecondaryTop && !stackController.top?.rectInfo) {
			await panTo(0, { withAnimation: true, needClamp: false });
		}

		_isAnimating = false;

		if (shouldCommitPop) {
			stackController.setAnimationPhase(null);
			stackController.pop(false);
		}
	};

	/**
	 * 执行 push 动画（由 animationPhase === 'push' 触发）
	 * 栈顶：从 rectInfo 或右侧弹入；第二层：左移到屏幕一半
	 */
	const runPushAnimation = async () => {
		const shouldCommitPush = $state.snapshot(isTop);

		_isAnimating = true;

		if (item.rectInfo && isTop) {
			// 是栈顶并且需要 push 触点动画
			await moveAndScaleTo(0, 0, 1, true);
		} else if (!item.rectInfo && isTop) {
			// 是栈顶并且不需要 push 触点动画
			panTo(el!.clientWidth, { withAnimation: false, needClamp: false });
			await panTo(0, { withAnimation: true, needClamp: false });
		} else if (isSecondaryTop && !stackController.top?.rectInfo) {
			// 是第二层栈顶并且栈顶不需要 push 触点动画
			await panTo(-(el!.clientWidth / 2), { withAnimation: true, needClamp: false });
		}

		_isAnimating = false;

		if (shouldCommitPush) {
			stackController.setAnimationPhase(null);
		}
	};

	/**
	 * 响应 animationPhase 变化，执行 push/pop 动画
	 *
	 * `untrack(run*)`：避免订阅 run*Animation 内部的 isTop/item/top 等，防止 phase 未变时
	 * 因懒加载、栈替换重复启动动画（见 effect_update_depth_exceeded）。
	 * 若出现嵌套更新深度报错，再考虑用 `queueMicrotask` 把启动推迟到当前 flush 之后。
	 */
	$effect(() => {
		const phase = stackController.animationPhase;
		if (phase !== 'pop' && phase !== 'push') return;

		untrack(() => {
			if (phase === 'pop') {
				runPopAnimation();
			} else {
				runPushAnimation();
			}
		});
	});

	/**
	 * 响应 swipeState 变化，更新非 pointer 手势目标的 stack-item 的动画
	 * 非主控，不用对 _isAnimating, stackController.setSwipeState 做处理
	 */
	$effect(() => {
		const state = stackController.swipeState;

		if (!state) return;

		untrack(async () => {
			if (state.type === 'onMove') {
				if (isSecondaryTop && !stackController.top?.rectInfo && !stackController.isPushingNext) {
					panTo(state.deltaX * 0.5 - el!.clientWidth / 2, {
						withAnimation: false,
						needClamp: false
					});
				} else if (isTop && isNext && stackController.isPushingNext) {
					panTo(state.deltaX + el!.clientWidth, { withAnimation: false, needClamp: false });
				}
			} else if (state.type === 'onEnd') {
				if (isSecondaryTop && !stackController.top?.rectInfo && !stackController.isPushingNext) {
					const half = el!.clientWidth / 2;
					if (state.direction === 'right' && state.committed) {
						await panTo(0, { withAnimation: true, needClamp: false });
					} else {
						await panTo(-half, { withAnimation: true, needClamp: false });
					}
				} else if (isTop && isNext && stackController.isPushingNext) {
					if (state.direction === 'left' && state.committed) {
						await panTo(0, { withAnimation: true, needClamp: false });
					} else {
						await panTo(el!.clientWidth, { withAnimation: true, needClamp: false });
					}
				}
			}
		});
	});

	/**
	 * 仅根据当前尺寸与 `item.rectInfo` 写入 `initTranslate*` / `initScale`，不写 DOM。
	 * maxVisible 卸载后带快照再挂载时，若跳过此步骤则 `runPopAnimation` 的 rect 目标仍为 0，导致触点 pop 动画消失或错乱。
	 *
	 * @param sizeEl - 用于测量 clientWidth/clientHeight 的容器元素
	 */
	const applyInitLayoutVars = (sizeEl: HTMLElement) => {
		if (isNext) {
			initScale = 1;
			initTranslateX = sizeEl.clientWidth;
			initTranslateY = 0;
		} else if (item.rectInfo) {
			initScale = item.rectInfo.width / sizeEl.clientWidth;
			initTranslateX = item.rectInfo.left;
			initTranslateY =
				item.rectInfo.top - (sizeEl.clientHeight * initScale - item.rectInfo.height) / 2;
		} else {
			initScale = 1;
			initTranslateX = sizeEl.clientWidth;
			initTranslateY = 0;
		}
	};

	const initLayout = (sizeEl: HTMLElement) => {
		// 用 el.clientWidth 和 el.clientHeight 代替 el!.clientWidth 和 el!.clientHeight，防止 init 时 el!.clientWidth 和 el!.clientHeight 还未更新
		applyInitLayoutVars(sizeEl);
		moveAndScaleTo(initTranslateX, initTranslateY, initScale, false);

		const _ = getComputedStyle(el!).transform; // 读取样式，强制触发 layout，防止在 onMount 瞬间先触发 initLayout 的 moveAndScaleTo 又紧接着触发 runPushAnimation 的 moveAndScaleTo 导致没有动画效果
	};

	onMount(() => {
		if (!el) return;

		const cached = getDomSnapshot(item.id);
		if (cached) {
			// 恢复上次卸载前的样式，避免因重新挂载导致突兀回到 initLayout 起点
			el.style.transform = cached.transform;
			el.style.clipPath = cached.clipPath;
			el.style.transition = cached.transition;
			applyInitLayoutVars(el); // 恢复上次的布局后也要记得计算 init 数据，否则布局与状态不一致会导致 bug
			return;
		}

		initLayout(el);
	});

	onDestroy(() => {
		if (!el) return;

		/**
		 * 仅在元素仍在 stack 内时保存：
		 * - true：通常是 maxVisible 裁剪触发的临时卸载，后续需要恢复
		 * - false：已真正出栈，不需要缓存，避免无意义积累
		 */
		if (!stackController.items.some((stackItem) => stackItem.id === item.id)) return;

		setDomSnapshot(item.id, {
			transform: el.style.transform,
			clipPath: el.style.clipPath,
			transition: el.style.transition
		});

		// 卸载时关闭本层 `el` 上的局部 Loading，避免指向已分离 DOM
		Loading.hide({ target: el });
	});

	$effect(() => {
		if (!el) return;

		if (DynamicComponent) {
			Loading.hide({ target: el });
		} else {
			Loading.show({ target: el });
		}
	});
</script>

<!--
  全屏覆盖层
  - position: fixed; inset: 0 脱离文档流，覆盖整个视口
	- pt/pb-[env(...)] 必须用 padding，否则 translateY 就不是基于 viewport 的了，originTranslateY 会比真正位置更靠下
-->
<div
	bind:this={el}
	style:z-index={zIndex}
	style:will-change="transform,clip-path"
	style:transform-origin={transformOrigin}
	class={`fixed inset-0 bg-background ${item.ignoreSafeArea ? '' : `pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]`}`}
	use:swipe={swipeOptions}
	use:edgeZone={{ left: 24 }}
>
	{#if DynamicComponent}
		<DynamicComponent {...item.props} bind:this={componentEl} />
	{/if}
</div>
