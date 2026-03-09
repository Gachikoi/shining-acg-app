/**
 * @file 滚动边界声明 Svelte Action
 * @description
 * 纯声明式 action：向 GestureArena 注册一个可滚动的 DOM 区域。
 *
 * 自身不处理任何手势事件，仅提供 `canScroll(axis, direction)` 实时查询能力。
 * Arena 在 tryAcquire 时查询已注册的 scrollBoundary 来实现"边界让渡"：
 * - 子区域还能在当前方向滚动 → 让子处理（父手势被 reject）
 * - 子区域已到边界 → 让渡给父手势
 *
 * @example
 * ```svelte
 * <div use:scrollBoundary={{ axis: 'x' }} class="overflow-x-scroll">
 *   <!-- 横向可滚动内容 -->
 * </div>
 * ```
 */

import type { Action } from 'svelte/action';
import { registerScrollBoundary } from './arena.svelte';
import type { Axis, ScrollBoundaryOptions } from './types';

/**
 * 滚动边界声明 Svelte Action
 *
 * @param node - 可滚动的 DOM 元素
 * @param initialOptions - 配置选项
 * @returns Svelte Action 返回值（update / destroy）
 */
export const scrollBoundary: Action<HTMLElement, ScrollBoundaryOptions | undefined> = (
	node,
	initialOptions
) => {
	let opts: ScrollBoundaryOptions = { ...initialOptions };
	let unregister: (() => void) | null = null;

	/**
	 * 根据当前配置注册（或重新注册）到 Arena
	 */
	function register() {
		// 取消上一次注册
		unregister?.();

		const axis = opts.axis ?? 'both';

		unregister = registerScrollBoundary(node, {
			axis,
			/**
			 * 实时查询此节点在指定轴+方向上是否还有滚动余量
			 *
			 * @param queryAxis - 查询轴向
			 * @param direction - 方向：正值 = 坐标增大方向（右/下），负值反之
			 * @returns true 表示还能滚动（子处理），false 表示到边界（让渡给父）
			 */
			canScroll(queryAxis: Axis, direction: number): boolean {
				// 如果注册的 axis 不匹配查询轴，不参与该轴的让渡判断
				if (axis !== 'both' && axis !== queryAxis) return false;

				// 容忍 1px 浮点误差
				const EPSILON = 1;

				if (queryAxis === 'x') {
					const maxScrollLeft = node.scrollWidth - node.clientWidth;
					if (maxScrollLeft <= 0) return false;

					if (direction > 0) {
						// 指针右移 → 内容需要能左滚 → scrollLeft > 0
						return node.scrollLeft > EPSILON;
					}
					// 指针左移 → 内容需要能右滚 → scrollLeft < max
					return node.scrollLeft < maxScrollLeft - EPSILON;
				}

				// queryAxis === 'y'
				const maxScrollTop = node.scrollHeight - node.clientHeight;
				if (maxScrollTop <= 0) return false;

				if (direction > 0) {
					// 指针下移 → 内容需要能上滚 → scrollTop > 0
					return node.scrollTop > EPSILON;
				}
				// 指针上移 → 内容需要能下滚 → scrollTop < max
				return node.scrollTop < maxScrollTop - EPSILON;
			}
		});
	}

	// 首次注册
	register();

	return {
		update(newOptions: ScrollBoundaryOptions | undefined) {
			opts = { ...newOptions };
			register();
		},
		destroy() {
			unregister?.();
		}
	};
};
