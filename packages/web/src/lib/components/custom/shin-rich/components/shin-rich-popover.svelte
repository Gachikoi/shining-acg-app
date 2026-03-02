<!--
	@component ShinRichPopover
	@description @ 用户选择弹层（内部组件，由 ShinRichTextarea 使用）
	@internal 不对外导出，请勿直接使用

	## 概述
	为 ShinRichTextarea 提供 @ 用户选择能力。固定定位在光标或按钮附近，不抢夺 contenteditable 焦点。
	支持点击选择、上下键切换、Enter 确认、Escape 关闭。
	移动端优化：viewport 边界约束、触摸目标、虚拟键盘适配、底部抽屉模式。

	## Props
	- open: 是否显示
	- userList: 可选用户列表（MentionUser[]）
	- position: 定位坐标 { left, top }
	- selectedIndex: 当前选中索引（可绑定）
	- onSelect: 选择用户回调
	- onClose / onClickOutside: 关闭回调
	- ignoreClickRef: 点击不关闭的容器（如 contenteditable）

	## MentionUser 类型
	{ id, qq, name, avatar?, remark? }
-->

<script lang="ts">
	import { cn } from '$lib/utils';
	import { slide } from 'svelte/transition';

	export type MentionUser = {
		id: string;
		qq: string;
		name: string;
		avatar?: string;
		remark?: string;
	};

	type Props = {
		open?: boolean;
		userList?: MentionUser[];
		position?: { left: number; top: number };
		selectedIndex?: number;
		onSelect?: (user: MentionUser) => void;
		onClose?: () => void;
		onClickOutside?: () => void;
		/** 点击在此元素内时不关闭（如 contenteditable） */
		ignoreClickRef?: HTMLElement | null;
	};

	let {
		open = $bindable(false),
		userList = [],
		position = { left: 0, top: 0 },
		selectedIndex = $bindable(0),
		onSelect,
		onClose,
		onClickOutside,
		ignoreClickRef = null
	}: Props = $props();

	let dropdownRef = $state<HTMLDivElement | null>(null);
	let adjustedPosition = $state<{ left: number; top: number; width?: number }>({ left: 0, top: 0 });
	let isMobile = $state(false);
	let isDrawerMode = $state(false);
	let viewportUpdateTrigger = $state(0);

	// 检测移动端：小屏或粗指针（触摸设备）
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mqWidth = window.matchMedia('(max-width: 640px)');
		const mqPointer = window.matchMedia('(pointer: coarse)');
		const check = () => {
			isMobile = mqWidth.matches || mqPointer.matches;
			isDrawerMode = isMobile;
		};
		check();
		mqWidth.addEventListener('change', check);
		mqPointer.addEventListener('change', check);
		return () => {
			mqWidth.removeEventListener('change', check);
			mqPointer.removeEventListener('change', check);
		};
	});

	// Viewport 边界约束 + visualViewport 虚拟键盘适配
	$effect(() => {
		// 下面一行是该 effect 的依赖，这样写是为了避免触发 eslint 警告
		void [position, selectedIndex, viewportUpdateTrigger];

		if (!open || !dropdownRef) return;

		const vv = window.visualViewport;
		const vw = vv?.width ?? window.innerWidth;
		const vh = vv?.height ?? window.innerHeight;
		const vx = vv?.offsetLeft ?? 0;
		const vy = vv?.offsetTop ?? 0;

		const rect = dropdownRef.getBoundingClientRect();
		const pad = 8;

		if (isDrawerMode) {
			// 底部抽屉：固定在 visualViewport 底部，全宽
			const drawerHeight = Math.min(rect.height || vh * 0.5, vh * 0.5);
			adjustedPosition = {
				left: vx + pad,
				top: vy + vh - drawerHeight - pad,
				width: vw - 2 * pad
			};
		} else {
			let { left, top } = position;
			if (left + rect.width > vx + vw - pad) left = vx + vw - rect.width - pad;
			if (left < vx + pad) left = vx + pad;
			if (top + rect.height > vy + vh - pad) top = vy + vh - rect.height - pad;
			if (top < vy + pad) top = vy + pad;
			adjustedPosition = { left, top };
		}

		// 选中项滚动到可视区域（有选项时）
		if (userList.length > 0) {
			const option = dropdownRef.querySelector<HTMLElement>(
				`[role="option"][aria-selected="true"]`
			);
			option?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
		}
	});

	// 监听 visualViewport 变化（虚拟键盘弹出/收起时重新定位）
	$effect(() => {
		if (!open) return;
		const vv = window.visualViewport;
		if (!vv) return;
		const onViewportChange = () => {
			viewportUpdateTrigger++;
		};
		vv.addEventListener('resize', onViewportChange);
		vv.addEventListener('scroll', onViewportChange);
		return () => {
			vv.removeEventListener('resize', onViewportChange);
			vv.removeEventListener('scroll', onViewportChange);
		};
	});

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		const len = userList.length;

		if (e.key === 'ArrowDown' && len > 0) {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % len;
			return;
		}
		if (e.key === 'ArrowUp' && len > 0) {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + len) % len;
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			const user = userList[selectedIndex];
			if (user) onSelect?.(user);
			else onClose?.();
			return;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose?.();
		}
	}

	function isOutside(target: Node): boolean {
		if (!dropdownRef) return true;
		if (dropdownRef.contains(target)) return false;
		if (ignoreClickRef?.contains(target)) return false;
		return true;
	}

	function handleClickOutside(e: MouseEvent) {
		if (!open) return;
		if (isOutside(e.target as Node)) onClickOutside?.();
	}

	function handleTouchEndOutside(e: TouchEvent) {
		if (!open) return;
		const touch = e.changedTouches?.[0];
		if (!touch) return;
		const target = document.elementFromPoint(touch.clientX, touch.clientY);
		if (target && isOutside(target)) onClickOutside?.();
	}
</script>

<svelte:window
	onkeydown={handleKeydown}
	onclick={handleClickOutside}
	ontouchend={handleTouchEndOutside}
/>

{#snippet popoverContent()}
	{#if userList.length === 0}
		<div class="min-h-[44px] px-4 py-3 text-muted-foreground">无匹配用户</div>
	{:else}
		{#each userList as user, i (user.id)}
			<button
				type="button"
				role="option"
				class="flex min-h-[44px] items-center gap-2 px-4 py-3 text-left hover:bg-muted active:bg-muted"
				class:bg-muted={i === selectedIndex}
				data-selected={i === selectedIndex}
				aria-selected={i === selectedIndex}
				onclick={() => onSelect?.(user)}
				onmousedown={(e) => e.preventDefault()}
			>
				{#if user.avatar}
					<img src={user.avatar} alt={user.name} class="size-6 shrink-0 rounded-full" />
				{:else}
					<div
						class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs"
					>
						{user.name.charAt(0)}
					</div>
				{/if}
				<div class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
					{user.remark ?? user.name}
				</div>
			</button>
		{/each}
	{/if}
{/snippet}

{#if open}
	{#if isDrawerMode}
		<div
			bind:this={dropdownRef}
			role="listbox"
			tabindex="-1"
			class={cn(
				'z-50 overflow-y-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md',
				'flex flex-col text-sm',
				'max-w-[min(90vw,16rem)] min-w-48',
				'max-h-[40vh] w-full rounded-t-xl'
			)}
			style={adjustedPosition.width != null
				? `position:fixed;left:${adjustedPosition.left}px;top:${adjustedPosition.top}px;width:${adjustedPosition.width}px;`
				: `position:fixed;left:${adjustedPosition.left}px;top:${adjustedPosition.top}px;`}
			aria-hidden="false"
			in:slide
			out:slide
		>
			{@render popoverContent()}
		</div>
	{:else}
		<div
			bind:this={dropdownRef}
			role="listbox"
			tabindex="-1"
			class={cn(
				'z-50 overflow-y-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md',
				'flex flex-col text-sm',
				'max-w-[min(90vw,16rem)] min-w-48',
				'max-h-64'
			)}
			style={`position:fixed;left:${adjustedPosition.left}px;top:${adjustedPosition.top}px;`}
			aria-hidden="false"
		>
			{@render popoverContent()}
		</div>
	{/if}
{/if}
