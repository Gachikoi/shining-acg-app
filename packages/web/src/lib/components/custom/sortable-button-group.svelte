<script lang="ts">
	import { resolve } from '$app/paths';
	import { draggableScroll, longPressSort, contextPopover } from '$lib/actions';
	import { cn } from '$lib/utils';
	import * as Popover from '$lib/components/ui/popover';
	import PopoverTrigger from '$lib/components/ui/popover/popover-trigger.svelte';

	type ButtonItem = {
		label: string;
		href: string;
	};

	let {
		items,
		activePath,
		storageKey,
		longPressDuration = 200,
		// 默认排序触发位移阈值适当调小，方便 PC 上在按钮宽度范围内完成一次换位
		moveThreshold = 40,
		navClass = '',
		buttonClass = ''
	}: {
		items: ButtonItem[];
		activePath?: string;
		storageKey?: string;
		longPressDuration?: number;
		moveThreshold?: number;
		navClass?: string;
		buttonClass?: string;
	} = $props();

	function loadItems(baseItems: ButtonItem[]): ButtonItem[] {
		if (!storageKey || typeof window === 'undefined') return [...baseItems];

		try {
			const stored = window.localStorage.getItem(storageKey);
			if (!stored) return [...baseItems];

			const hrefOrder = JSON.parse(stored) as string[];
			// 使用普通数组操作而非 Map，避免违反 svelte/prefer-svelte-reactivity 规则
			const remaining = [...baseItems];
			const ordered: ButtonItem[] = [];

			for (const href of hrefOrder) {
				const index = remaining.findIndex((item) => item.href === href);
				if (index !== -1) {
					ordered.push(remaining[index]);
					remaining.splice(index, 1);
				}
			}

			// 把新加的/遗漏的项补到最后
			return [...ordered, ...remaining];
		} catch {
			return [...baseItems];
		}
	}

	function saveItems(items: ButtonItem[]) {
		if (!storageKey || typeof window === 'undefined') return;
		try {
			const hrefOrder = items.map((item) => item.href);
			window.localStorage.setItem(storageKey, JSON.stringify(hrefOrder));
		} catch {
			// ignore
		}
	}

	// 当前组合使用 $state + $effect 逻辑清晰，在此禁用 prefer-writable-derived 规则。
	// eslint-disable-next-line svelte/prefer-writable-derived
	let internalItems = $state<ButtonItem[]>(loadItems(items));

	// 当外部 items 变化时，重新加载（保持与存储顺序对齐）
	$effect(() => {
		internalItems = loadItems(items);
	});

	// 每个按钮对应的 Popover 打开状态（按 href 作为 key）
	let popoverOpenMap = $state<Record<string, boolean>>(
		Object.fromEntries(items.map((item) => [item.href, false]))
	);

	let isSorting = $state(false);

	function isPathActive(href: string): boolean {
		if (!activePath) return false;
		const resolved = resolve(
			// @ts-expect-error - SvelteKit resolve 类型限制，实际路径存在
			href
		);
		return activePath === resolved || activePath.startsWith(resolved + '/');
	}

	function openPopoverFor(href: string, e?: MouseEvent) {
		e?.preventDefault();
		for (const key in popoverOpenMap) {
			popoverOpenMap[key] = false;
		}
		popoverOpenMap[href] = true;
	}

	function handleContextMenu(item: ButtonItem, event: MouseEvent) {
		openPopoverFor(item.href, event);
	}
</script>

<nav
	use:draggableScroll={{
		direction: 'horizontal',
		dragThreshold: 5,
		scrollSpeed: 1,
		enabled: !isSorting,
		shouldPreventClick: (hasMoved) => hasMoved
	}}
	class={cn('scrollbar-hide flex h-[72px] items-center gap-[10px] overflow-x-auto pb-2', navClass)}
>
	{#each internalItems as item (item.href)}
		{@const active = isPathActive(item.href)}
		<Popover.Root bind:open={popoverOpenMap[item.href]}>
			<PopoverTrigger>
				<a
					href={resolve(
						// @ts-expect-error - SvelteKit resolve 类型限制，实际路径存在
						item.href
					)}
					draggable="false"
					data-sveltekit-preload-code="eager"
					data-sveltekit-replacestate
					data-sveltekit-preload-data="tap"
					class={cn(
						'flex h-10 w-24 items-center justify-center rounded-full px-4 py-2 text-base whitespace-nowrap transition-colors select-none',
						active
							? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
							: 'font-normal text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800',
						buttonClass
					)}
					use:longPressSort={{
						item,
						getItems: () => internalItems,
						setItems: (items) => (internalItems = items),
						orientation: 'horizontal',
						duration: longPressDuration,
						moveThreshold,
						onOrderChange: (items) => saveItems(items as ButtonItem[]),
						onSortStart: () => {
							isSorting = true;
						},
						onSortEnd: () => {
							isSorting = false;
						}
					}}
					use:contextPopover={{
						onTrigger: (event) => handleContextMenu(item, event)
					}}
				>
					{item.label}
				</a>
			</PopoverTrigger>

			<Popover.Content class="w-44 p-2 text-sm">
				<div class="space-y-1">
					<div class="font-medium text-zinc-900 dark:text-zinc-50">{item.label}</div>
					<div class="text-xs text-zinc-500 dark:text-zinc-400">
						这里是该管理分组的操作入口，后续可以在这里扩展更多功能。
					</div>
				</div>
			</Popover.Content>
		</Popover.Root>
	{/each}
</nav>
