/**
 * @file Stack 全局状态管理
 * @description
 * 基于 Svelte 5 Runes 的单例全局栈状态。
 * 在 `.svelte.ts` 文件中使用模块顶层 `$state`，
 * 确保整个应用生命周期内共享同一个栈实例（单例模式）。
 *
 * 架构说明（v2 响应式重构）：
 * - swipeState：栈顶 swipe 手势写入，所有 StackItem 通过 $effect 响应式读取
 * - animationPhase：push/pop 时设置，各 StackItem 根据角色执行对应动画
 * - 不再使用 appBus 进行 stack 内部通信
 *
 * @example
 * ```typescript
 * import { push, pop, stackState } from '$lib/components/custom/stack';
 *
 * // 静态 push（无循环依赖时）
 * push({ component: DetailPage, props: { id: '123' } });
 *
 * // 懒加载 push（子组件 push 父组件 / push 自身，解决循环 import）
 * push({ loader: () => import('./detail-page.svelte'), props: { id: '123' } });
 *
 * // 弹出栈顶
 * pop();
 * ```
 */

import type { SwipeState } from '$lib/modules/gesture';
import { tick } from 'svelte';
import { toast } from 'svelte-sonner';
import type { PushOptions, PushOptionsWithoutNext, StackItem } from './types';

// ─── 全局栈状态 ──────────────────────────────────────────────────

let _items = $state<StackItem[]>([]);

let locked = false;

/**
 * 栈内部响应式状态（swipe + 动画阶段）
 * 使用对象包装以便在 .ts 文件中正确触发 $state 更新
 */
const _stackState = $state({
	/** 当前滑动手势状态，仅栈顶写入，全员读取 */
	swipe: null as (SwipeState & { type: 'onMove' | 'onEnd' }) | null,
	/** 动画阶段：'push' | 'pop' | null */
	animationPhase: null as 'push' | 'pop' | null
});

const stackController = (() => {
	// ─── 内部方法（供 StackItem 调用） ────────────────────────────────

	/**
	 * 设置滑动手势状态
	 * 仅栈顶 StackItem 在 swipe onMove/onEnd 时调用
	 *
	 * @param state - 当前手势状态，null 表示手势结束
	 */
	function setSwipeState(state: (SwipeState & { type: 'onMove' | 'onEnd' }) | null): void {
		_stackState.swipe = state;
	}

	/**
	 * 设置动画阶段
	 * push/pop 时由 stackController 内部调用
	 *
	 * @param phase - 动画阶段
	 */
	function setAnimationPhase(phase: 'push' | 'pop' | null): void {
		_stackState.animationPhase = phase;
	}

	/**
	 * 将新条目并入栈数组
	 *
	 * @param newItem - push / pushNext 传入的选项（含 component 或 loader）
	 * @param isNext - 是否作为左滑 next 入栈（写入 StackItem.isNext）
	 * @returns 已追加新元素后的新栈数组；loader 失败时 reject
	 */
	const pushToStack = (newItem: PushOptions | PushOptionsWithoutNext, isNext: boolean) => {
		const id = crypto.randomUUID();

		_items = [
			..._items,
			{
				id,
				component: 'loader' in newItem ? null : newItem.component,
				props: newItem.props,
				rectInfo: newItem.rectInfo,
				next: 'next' in newItem ? newItem.next : undefined,
				isNext: isNext,
				ignoreSafeArea: newItem.ignoreSafeArea
			} as StackItem
		];

		const idx = _items.length - 1;

		if ('loader' in newItem) {
			try {
				newItem.loader().then((mod) => {
					_items[idx].component = mod.default;
				});
			} catch {
				toast.error('加载组件失败');
				pop();
			}
		}
	};

	// ─── 操作函数 ────────────────────────────────────────────────────

	/**
	 * 将组件 push 进栈（成为新的栈顶）
	 *
	 * 支持两种形式：
	 * - **静态**：`{ component: MyComp, props }` — 直传组件引用，立即渲染
	 * - **懒加载**：`{ loader: () => import('./my-comp.svelte'), props }` —
	 *   先占位（显示加载态），loader resolve 后再渲染真实组件。
	 *   用于解决子组件 push 父组件 / push 自身产生的循环 import 问题。
	 *
	 * @param options - push 参数（StaticPushOptions 或 LazyPushOptions）
	 * @returns 新元素的唯一 id，可用于后续 popById 精确出栈
	 */
	async function push(options: PushOptions) {
		/** `animationPhase !== null`：push / pop 任一类过渡进行中均不可再 push（pop 时 `locked` 已释放，仅靠 phase 防御） */
		if (_stackState.animationPhase !== null || locked) return;
		locked = true;

		pushToStack(options, false);
		await tick();
		setAnimationPhase('push');
		// 注意：animationPhase 由各 StackItem 在动画完成后置为 null

		locked = false;
	}

	/**
	 * 弹出栈顶元素
	 * @param isNeedAnimation 默认为 true，会展示 pop 动画后再弹出 item。
	 * @returns 被弹出的元素，若栈为空则返回 undefined
	 */
	function pop(isNeedAnimation: boolean = true): StackItem | undefined {
		console.log('pop', _items.length, _stackState.animationPhase, locked);
		if (_items.length === 0 || _stackState.animationPhase !== null || locked) {
			// 前者防止栈空时 pop 重复触发，中间防止动画时重复触发，后者防止 pop 并发调用
			return undefined;
		}
		locked = true;

		if (isNeedAnimation) {
			// 如果需要动画，设置 phase 由各 StackItem 响应式执行，栈顶动画结束后调用 commitPop
			setAnimationPhase('pop');
			locked = false;
			return;
		}

		/**
		 * 无动画出栈必须用「替换数组引用」，不能对 `$state` 数组原地 `.pop()`：
		 * StackContainer 等处通过 `stackController.items` 建立派生依赖时，
		 * 原地 mutating pop 在某些消费路径下不会触发 UI 失效（栈数据已变但 {#each} 仍保留旧层）。
		 */
		const removed = _items[_items.length - 1];
		_items = _items.slice(0, -1);
		locked = false;

		return removed;
	}

	/**
	 * 清空整个栈
	 * 通常用于应用重置或退出登录等场景
	 */
	function clearStack(): void {
		/** 与 `pop(false)` 相同：赋值新数组，保证依赖 `items` 的视图一定刷新 */
		_items = [];
		locked = false;
		setAnimationPhase(null);
	}

	/**
	 * 用于在栈末尾元素有 next 属性，想要以从右侧滑入的方式载入 next 元素时
	 */
	const pushNext = async () => {
		const next = _items[_items.length - 1]?.next;

		if (!next) throw new Error('没有 next（待入栈的） 元素');

		pushToStack(next, true);
		await tick();
	};

	return {
		get items(): StackItem[] {
			return _items;
		},
		get length(): number {
			return _items.length;
		},
		/** 获取栈顶元素 */
		get top(): StackItem | undefined {
			return _items[_items.length - 1];
		},
		/** 当前滑动手势状态（只读，供 StackItem 响应式读取） */
		get swipeState(): (SwipeState & { type: 'onMove' | 'onEnd' }) | null {
			return _stackState.swipe;
		},
		/** 当前动画阶段（只读，供 StackItem 响应式读取） */
		get animationPhase(): 'push' | 'pop' | null {
			return _stackState.animationPhase;
		},
		setSwipeState,
		setAnimationPhase,
		push,
		pushNext,
		pop,
		clearStack
	};
})();

export default stackController;
