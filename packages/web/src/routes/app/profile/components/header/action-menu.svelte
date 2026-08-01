<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { BadgeCheck, Link2, MoreHorizontal, Pencil, Share2, Shield } from 'lucide-svelte';
	import type { ProfileActionId } from '../types';

	let {
		open = $bindable(false),
		onOpenChange,
		onAction
	}: {
		open?: boolean;
		onOpenChange?: (next: boolean) => void;
		onAction: (actionId: ProfileActionId) => void;
	} = $props();

	const items: { id: ProfileActionId; label: string; icon: typeof Share2 }[] = [
		{ id: 'share', label: '分享主页', icon: Share2 },
		{ id: 'editNickname', label: '修改昵称', icon: Pencil },
		{ id: 'applyIdentity', label: '申请身份认证', icon: Shield },
		{ id: 'editDeptBadge', label: '编辑部门徽章', icon: BadgeCheck },
		{ id: 'editSocialLinks', label: '编辑个人链接', icon: Link2 }
	];

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function handleAction(id: ProfileActionId) {
		setOpen(false);
		onAction(id);
	}
</script>

<Popover.Root bind:open onOpenChange={setOpen}>
	<Popover.Trigger
		type="button"
		class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
		aria-label="更多操作"
	>
		<MoreHorizontal class="size-5" />
	</Popover.Trigger>
	<Popover.Content
		align="end"
		class="z-50 min-w-48 rounded-xl border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900"
	>
		{#each items as item (item.id)}
			{@const Icon = item.icon}
			<button
				type="button"
				class="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={() => handleAction(item.id)}
			>
				<Icon class="size-4 shrink-0 opacity-70" aria-hidden="true" />
				{item.label}
			</button>
		{/each}
	</Popover.Content>
</Popover.Root>
