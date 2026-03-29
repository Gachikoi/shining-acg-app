/**
 * @file 命令式 Loading（全部通过 `mount` / `unmount`）
 * @description
 * - **全屏**：`Loading.show()` 将 `CommandLoadingHost` 挂到 `document.body`；`hide()` 卸载。
 * - **局部**：`Loading.show({ target })` 挂到 `target`；`hide({ target })` 卸载。
 */

import { browser } from '$app/environment';
import { mount, unmount } from 'svelte';
import CommandLoadingHost from './command-loading-host.svelte';

/** `document.body` 上的全屏实例 */
let fullscreenMount: Record<string, unknown> | null = null;

/** 已 mount 到各 target 上的实例 */
const scopedMounts = new Map<HTMLElement, Record<string, unknown>>();

export type LoadingOptions = {
	/** 局部挂载容器；不传则挂到 `document.body` 全屏 */
	target?: HTMLElement;
	/**
	 * 仅全屏（无 `target`）时生效，需高于 Stack 等层
	 * @default 10000
	 */
	zIndex?: number;
};

/**
 * 命令式 Loading（业务仅使用本对象）
 */
export const Loading = {
	/**
	 * 显示蒙层：无 `target` 时挂到 `document.body`；有 `target` 时挂到该节点内（铺满）
	 *
	 * @param options - `{ target?, zIndex? }` 可选
	 * @returns void
	 */
	show(options?: LoadingOptions): void {
		if (!browser) return;

		const target = options?.target;
		if (target === undefined) {
			if (fullscreenMount) return;
			fullscreenMount = mount(CommandLoadingHost, {
				target: document.body,
				props: {
					placement: 'fullscreen' as const,
					zIndex: options?.zIndex ?? 10_000
				}
			}) as Record<string, unknown>;
			return;
		}

		const existing = scopedMounts.get(target);
		if (existing) {
			unmount(existing);
			scopedMounts.delete(target);
		}
		const instance = mount(CommandLoadingHost, {
			target,
			props: { placement: 'scoped' as const }
		});
		scopedMounts.set(target, instance as Record<string, unknown>);
	},

	/**
	 * 关闭蒙层：无 `target` 时卸载 body 上全屏实例；有 `target` 时卸载该节点上的实例
	 *
	 * @param options - `{ target? }` 可选
	 * @returns void
	 */
	hide(options?: LoadingOptions): void {
		if (!browser) return;

		const target = options?.target;
		if (target === undefined) {
			if (fullscreenMount) {
				unmount(fullscreenMount);
				fullscreenMount = null;
			}
			return;
		}

		const instance = scopedMounts.get(target);
		if (instance) {
			unmount(instance);
			scopedMounts.delete(target);
		}
	}
};
