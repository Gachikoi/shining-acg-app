/**
 * @file 边缘优先区域声明 Svelte Action
 * @description
 * 声明式 action：向 GestureArena 注册一个边缘优先区域。
 *
 * 核心特性：
 * - 当子级手势（如 SwipeablePane 的 swipe）在该区域内触发同轴手势时，
 *   会被 arena 拒绝，从而将控制权让渡给父级手势（如 stack-item 的 pop swipe）。
 * - 适用于屏幕边缘右滑返回等场景。
 *
 * @example
 * ```svelte
 * <!-- 左右各 24px 为水平边缘优先区（常用于侧滑返回与内层横向 swipe 让渡） -->
 * <div use:edgeZone={{ left: 24, right: 24 }}>
 *   <SwipeablePane />
 * </div>
 * ```
 */

import type { Action } from 'svelte/action';
import { registerEdgeZone } from '../../../core/arena.svelte';
import type { EdgeZoneOptions } from './types';

/**
 * 边缘优先区域 Svelte Action
 *
 * @param node - 边缘区域所属的 DOM 元素
 * @param initialOptions - 配置选项
 * @returns Svelte Action 返回值（update / destroy）
 */
export const edgeZone: Action<HTMLElement, EdgeZoneOptions> = (node, initialOptions) => {
	let opts: EdgeZoneOptions = { ...initialOptions };
	let unregister: (() => void) | null = null;

	function register() {
		unregister?.();
		unregister = registerEdgeZone(node, opts);
	}

	register();

	return {
		update(newOptions: EdgeZoneOptions) {
			opts = { ...newOptions };
			register();
		},
		destroy() {
			unregister?.();
		}
	};
};
