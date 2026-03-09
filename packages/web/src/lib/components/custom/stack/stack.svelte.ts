/**
 * @file Stack 全局状态管理
 * @description
 * 基于 Svelte 5 Runes 的单例全局栈状态。
 * 在 `.svelte.ts` 文件中使用模块顶层 `$state`，
 * 确保整个应用生命周期内共享同一个栈实例（单例模式）。
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

import type { StackItem, PushOptions } from './types';

// ─── 全局栈状态 ──────────────────────────────────────────────────

/**
 * 栈中所有元素，以入栈顺序排列，末尾为栈顶（z-index 最高）
 * 使用模块顶层 $state，整个应用共享同一响应式实例
 */
const items = $state<StackItem[]>([]);
let _isAnimating = $state(false);

const stackController = (() => {
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
	function push<TProps extends Record<string, unknown>>(
		options: PushOptions<TProps>
	): string | undefined {
		if (_isAnimating) return undefined;
		const id = crypto.randomUUID();
		const item: StackItem = {
			id,
			// 静态：直接使用组件引用；懒加载：先置 null（加载态），resolve 后再赋值
			component: 'loader' in options ? null : options.component,
			props: (options.props ?? {}) as Record<string, unknown>
		};

		items.push(item);

		// ── 懒加载：后台 resolve loader ──────────────────────────────
		if ('loader' in options) {
			options
				.loader()
				.then((mod) => {
					// 找到对应 item（用户可能在 resolve 前已手动出栈，需检查）
					const idx = items.findIndex((i) => i.id === id);
					if (idx !== -1) {
						// Svelte 5 $state 深度响应式，直接赋值即可触发渲染更新
						items[idx].component = mod.default;
					}
				})
				.catch((err) => {
					// 加载失败：从栈中移除，防止出现无法交互的加载态
					console.error('[Stack] Failed to load component for item', id, err);
					popById(id);
				});
		}
		return id;
	}

	/**
	 * 弹出栈顶元素
	 *
	 * @returns 被弹出的元素，若栈为空则返回 undefined
	 */
	function pop(): StackItem | undefined {
		if (items.length === 0 || _isAnimating) {
			return undefined;
		}
		const item = items.pop();
		return item;
	}

	/**
	 * 按 id 弹出指定元素
	 *
	 * 用于非栈顶出栈场景（如 stack-item 内部手势触发出栈时，
	 * 目标元素是当前 item 而非一定是栈顶）
	 *
	 * @param id - 要弹出的元素唯一标识符
	 */
	function popById(id: string): void {
		console.log('popById', id, _isAnimating);
		if (_isAnimating) return;
		const index = items.findIndex((item) => item.id === id);
		if (index !== -1) {
			items.splice(index, 1);
		}
	}

	/**
	 * 清空整个栈
	 * 通常用于应用重置或退出登录等场景
	 */
	function clearStack(): void {
		items.length = 0;
	}

	return {
		get items(): StackItem[] {
			return items;
		},
		push,
		pop,
		popById,
		clearStack,
		get isAnimating(): boolean {
			return _isAnimating;
		},
		set isAnimating(value: boolean) {
			_isAnimating = value;
		}
	};
})();

export default stackController;
