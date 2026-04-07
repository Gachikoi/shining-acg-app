<!--
  @component ReorderGrid
  flex-wrap 等效网格上的 transform 拖拽排序（中间层 slotOrder，放手提交 onReorder）
-->
<script lang="ts" generics="T">
	import type { Action } from 'svelte/action';
	import { cn } from '$lib/utils.js';
	import { createWrapGridDragSort } from './wrap-grid-drag-sort.svelte';
	import type { ReorderGridProps, WrapGridDragSort } from './types';
	import {
		wrapGridCellPosition,
		wrapGridColumnCount,
		wrapGridHeightPx,
		wrapGridRowCount
	} from './wrap-grid';

	let {
		items,
		item: itemSnippet,
		footer,
		itemCellClass = 'h-24 w-24 shrink-0',
		disabled = false,
		delay = 450,
		delayOnTouchOnly = true,
		onReorder,
		onReorderError,
		onDragStart,
		onDragEnd,
		class: className,
		'aria-busy': ariaBusy
	}: ReorderGridProps<T> = $props();

	let containerEl = $state<HTMLElement | null>(null);
	let containerWidth = $state(0);
	let cellW = $state(0);
	let cellH = $state(0);
	let gapPx = $state(0);

	type CellBind = { sort: WrapGridDragSort; index: number };

	const reorderGridCell: Action<HTMLElement, CellBind> = (node, { sort: s, index }) => {
		let teardown = s.bindCellListeners(node, index);
		return {
			update({ sort: s2, index: i2 }) {
				teardown();
				teardown = s2.bindCellListeners(node, i2);
			},
			destroy() {
				teardown();
			}
		};
	};

	const sort = createWrapGridDragSort({
		getItemCount: () => items.length,
		getLayout: () =>
			containerEl != null && cellW > 0 && cellH > 0
				? {
						containerEl,
						contentWidthPx: containerWidth,
						cellW,
						cellH,
						gap: gapPx,
						itemCount: items.length,
						hasFooter: footer != null
					}
				: null,
		isDisabled: () => disabled,
		delay,
		delayOnTouchOnly,
		onReorder,
		onReorderError,
		onDragStart,
		onDragEnd
	});

	const columnCount = $derived(
		containerWidth > 0 && cellW > 0 ? wrapGridColumnCount(containerWidth, cellW, gapPx) : 1
	);

	const layoutSlotCount = $derived(items.length + (footer != null ? 1 : 0));

	const gridHeightPx = $derived(
		wrapGridHeightPx({
			rowCount: wrapGridRowCount(layoutSlotCount, columnCount),
			cellHeight: cellH,
			gap: gapPx
		})
	);

	$effect(() => {
		const el = containerEl;
		if (el == null) return;
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width ?? 0;
			containerWidth = w;
		});
		ro.observe(el);
		return () => ro.disconnect();
	});

	$effect(() => {
		const el = containerEl;
		if (el == null) return;
		void items.length;
		void itemCellClass;
		const t = requestAnimationFrame(() => {
			const probe =
				el.querySelector('[data-reorder-grid-cell]') ??
				el.querySelector('[data-reorder-grid-footer]');
			if (probe instanceof HTMLElement) {
				const r = probe.getBoundingClientRect();
				cellW = r.width;
				cellH = r.height;
			}
			const g = getComputedStyle(el).gap;
			const m = /^([\d.]+)px\s+([\d.]+)px$/.exec(g);
			if (m) {
				const a = Number(m[1]);
				const b = Number(m[2]);
				gapPx = Math.max(0, Math.max(a, b));
				return;
			}
			const s = /^([\d.]+)px$/.exec(g);
			gapPx = s ? Math.max(0, Number(s[1])) : 0;
		});
		return () => cancelAnimationFrame(t);
	});
</script>

<div
	bind:this={containerEl}
	class={cn('relative touch-manipulation', className)}
	style:min-height="{gridHeightPx}px"
	aria-busy={ariaBusy}
>
	{#each items as item, i (item)}
		{@const slot = sort.slotOrder.indexOf(i)}
		{@const pos = wrapGridCellPosition({
			index: Math.max(0, slot),
			columns: columnCount,
			cellWidth: cellW || 1,
			cellHeight: cellH || 1,
			gap: gapPx
		})}
		{@const tx = sort.phase === 'dragging' && sort.activeSourceIndex === i ? sort.dragX : pos.x}
		{@const ty = sort.phase === 'dragging' && sort.activeSourceIndex === i ? sort.dragY : pos.y}
		{@const dragZ = sort.phase === 'dragging' && sort.activeSourceIndex === i ? 2 : 1}
		{@const touchClamp =
			sort.touchLockedSourceIndex === i ||
			(sort.phase === 'dragging' && sort.activeSourceIndex === i)}
		<div
			class={cn(
				'absolute top-0 left-0 will-change-transform',
				itemCellClass,
				touchClamp ? 'touch-none **:touch-none' : 'touch-pan-y **:touch-pan-y'
			)}
			style="transform: translate({tx}px, {ty}px); z-index: {dragZ};"
			data-reorder-grid-cell
			use:reorderGridCell={{ sort, index: i }}
		>
			{@render itemSnippet(item, i)}
		</div>
	{/each}
	{#if footer != null}
		{@const fIndex = items.length}
		{@const fpos = wrapGridCellPosition({
			index: fIndex,
			columns: columnCount,
			cellWidth: cellW || 1,
			cellHeight: cellH || 1,
			gap: gapPx
		})}
		<div
			class={cn('absolute top-0 left-0 touch-pan-y', itemCellClass)}
			style="transform: translate({fpos.x}px, {fpos.y}px);"
			data-reorder-grid-cell
			data-reorder-grid-footer
		>
			{@render footer()}
		</div>
	{/if}
</div>
