<!--
	@component
	## ShinRichPopover - @ 用户选择弹层

	为富文本 textarea 服务的 @ 用户选择弹层，支持键盘导航与点击选择。
	使用自定义定位，不抢夺 contenteditable 焦点。
-->

<script lang="ts">
	import { cn } from '$lib/utils';

	export type MentionUser = { id: string; qq: string; name: string; avatar?: string };

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

	function handleClickOutside(e: MouseEvent) {
		if (!open || !dropdownRef) return;
		const target = e.target as Node;
		if (dropdownRef.contains(target)) return;
		if (ignoreClickRef?.contains(target)) return;
		onClickOutside?.();
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleClickOutside} />

{#if open}
	<div
		bind:this={dropdownRef}
		role="listbox"
		tabindex="-1"
		class={cn(
			'z-50 max-h-64 w-54 overflow-y-auto rounded-md border bg-popover p-0 text-popover-foreground shadow-md',
			'flex flex-col text-sm'
		)}
		style="position:fixed;left:{position.left}px;top:{position.top}px;"
		aria-hidden="false"
	>
		{#if userList.length === 0}
			<div class="px-4 py-3 text-muted-foreground">无匹配用户</div>
		{:else}
			{#each userList as user, i (user.id)}
				<button
					type="button"
					role="option"
					class="flex items-center gap-2 px-4 py-2 text-left hover:bg-muted {i === selectedIndex
						? 'bg-muted'
						: ''}"
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
						{user.name}
					</div>
				</button>
			{/each}
		{/if}
	</div>
{/if}
