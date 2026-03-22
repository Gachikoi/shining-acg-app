/**
 * @file 可排序列表 — Svelte 5 Action（SortableJS）
 * @description
 * 在列表根节点上创建 [Sortable](https://github.com/SortableJS/Sortable) 实例，`onEnd` 映射为 `onReorder(oldIndex, newIndex)`。
 * 与 Svelte `{#each}` 配合时请使用**稳定 key**；`itemCount` / `orderKey` 变化时会 `destroy` 再 `create`，避免子节点与实例状态错位。
 */

import type { Action } from 'svelte/action';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs';
import type { SortableListActionOptions } from './types';

const DEFAULT_DELAY_MS = 450;

export const sortableList: Action<HTMLElement, SortableListActionOptions> = (
	node,
	initialOptions
) => {
	let opts: SortableListActionOptions = { ...initialOptions };
	let instance: Sortable | null = null;
	let lastItemCount = opts.itemCount;
	let lastOrderKey = opts.orderKey;

	function isDisabled(): boolean {
		return opts.disabled?.() ?? false;
	}

	function mount(): void {
		instance?.destroy();
		instance = null;
		if (isDisabled() || opts.itemCount <= 0) return;

		const delay = opts.delay ?? DEFAULT_DELAY_MS;
		const delayOnTouchOnly = opts.delayOnTouchOnly ?? true;

		instance = Sortable.create(node, {
			draggable: opts.itemSelector,
			animation: 200,
			easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
			delay,
			delayOnTouchOnly,
			onStart(evt: SortableEvent) {
				const el = evt.item;
				if (el instanceof HTMLElement) {
					opts.onDragStart?.(el);
				}
			},
			onEnd(evt: SortableEvent) {
				try {
					const { oldIndex, newIndex } = evt;
					if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
						opts.onReorder(oldIndex, newIndex);
					}
				} catch (error) {
					console.error('sortableList onReorder failed:', error);
				} finally {
					opts.onDragEnd?.();
				}
			}
		});
	}

	function syncDisabled(): void {
		const off = isDisabled();
		if (off && instance) {
			instance.destroy();
			instance = null;
		} else if (!off && !instance) {
			mount();
		}
	}

	mount();

	return {
		update(newOptions: SortableListActionOptions) {
			const prevCount = lastItemCount;
			const prevKey = lastOrderKey;
			opts = { ...newOptions };
			lastItemCount = opts.itemCount;
			lastOrderKey = opts.orderKey;
			if (opts.itemCount !== prevCount || opts.orderKey !== prevKey) {
				mount();
			} else {
				syncDisabled();
			}
		},
		destroy() {
			instance?.destroy();
			instance = null;
		}
	};
};
