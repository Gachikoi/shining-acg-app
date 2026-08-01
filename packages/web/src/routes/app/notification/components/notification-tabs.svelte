<!--
  @component NotificationTabs
  通知中心五分类 Tab：固定顺序、分类色、活动态描边、数量角标、键盘可访问。
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import { Heart } from 'lucide-svelte';
	import {
		EMPTY_NOTIFICATION_UNREAD_COUNTS,
		NOTIFICATION_TABS,
		formatNotificationBadgeCount,
		type NotificationTabId,
		type NotificationTabTone,
		type NotificationUnreadCounts
	} from './notification-tabs';

	let {
		activeTab = $bindable<NotificationTabId>('messages'),
		unreadCounts = EMPTY_NOTIFICATION_UNREAD_COUNTS,
		class: className
	}: {
		activeTab?: NotificationTabId;
		unreadCounts?: NotificationUnreadCounts;
		class?: string;
	} = $props();

	const toneStyles: Record<
		NotificationTabTone,
		{ idle: string; active: string; iconIdle: string; iconActive: string }
	> = {
		amber: {
			idle: 'bg-amber-100 text-zinc-900 dark:bg-amber-950/50 dark:text-zinc-50',
			active:
				'bg-amber-400 text-white ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:bg-amber-500 dark:ring-amber-300 dark:ring-offset-zinc-950',
			iconIdle: 'bg-amber-400 text-white',
			iconActive: 'bg-white/25 text-white'
		},
		emerald: {
			idle: 'bg-emerald-100 text-zinc-900 dark:bg-emerald-950/50 dark:text-zinc-50',
			active:
				'bg-emerald-500 text-white ring-2 ring-emerald-600 ring-offset-2 ring-offset-white dark:bg-emerald-600 dark:ring-emerald-300 dark:ring-offset-zinc-950',
			iconIdle: 'bg-emerald-500 text-white',
			iconActive: 'bg-white/25 text-white'
		},
		red: {
			idle: 'bg-red-100 text-zinc-900 dark:bg-red-950/50 dark:text-zinc-50',
			active:
				'bg-red-500 text-white ring-2 ring-red-600 ring-offset-2 ring-offset-white dark:bg-red-600 dark:ring-red-300 dark:ring-offset-zinc-950',
			iconIdle: 'bg-red-500 text-white',
			iconActive: 'bg-white/25 text-white'
		},
		sky: {
			idle: 'bg-sky-100 text-zinc-900 dark:bg-sky-950/50 dark:text-zinc-50',
			active:
				'bg-sky-500 text-white ring-2 ring-sky-600 ring-offset-2 ring-offset-white dark:bg-sky-600 dark:ring-sky-300 dark:ring-offset-zinc-950',
			iconIdle: 'bg-sky-500 text-white',
			iconActive: 'bg-white/25 text-white'
		},
		zinc: {
			idle: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50',
			active:
				'bg-zinc-500 text-white ring-2 ring-zinc-600 ring-offset-2 ring-offset-white dark:bg-zinc-600 dark:ring-zinc-300 dark:ring-offset-zinc-950',
			iconIdle: 'bg-zinc-500 text-white',
			iconActive: 'bg-white/25 text-white'
		}
	};

	function selectTab(tabId: NotificationTabId) {
		activeTab = tabId;
	}

	function focusTabButton(tabId: NotificationTabId) {
		const el = document.getElementById(`notification-tab-${tabId}`);
		el?.focus();
	}

	function onTabKeydown(event: KeyboardEvent, tabId: NotificationTabId) {
		const index = NOTIFICATION_TABS.findIndex((tab) => tab.id === tabId);
		if (index < 0) return;

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selectTab(tabId);
			return;
		}

		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault();
			const delta = event.key === 'ArrowRight' ? 1 : -1;
			const nextIndex = (index + delta + NOTIFICATION_TABS.length) % NOTIFICATION_TABS.length;
			const nextTab = NOTIFICATION_TABS[nextIndex];
			selectTab(nextTab.id);
			queueMicrotask(() => focusTabButton(nextTab.id));
		}
	}
</script>

<div
	class={cn('flex min-h-11 flex-wrap items-center gap-3', className)}
	role="tablist"
	aria-label="通知分类"
>
	{#each NOTIFICATION_TABS as tab (tab.id)}
		{@const selected = activeTab === tab.id}
		{@const styles = toneStyles[tab.tone]}
		{@const badgeText = formatNotificationBadgeCount(unreadCounts[tab.id])}
		<button
			type="button"
			id={`notification-tab-${tab.id}`}
			role="tab"
			aria-selected={selected}
			aria-controls={`notification-panel-${tab.id}`}
			tabindex={selected ? 0 : -1}
			class={cn(
				'relative inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors',
				'focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-zinc-950',
				selected ? styles.active : styles.idle
			)}
			onclick={() => selectTab(tab.id)}
			onkeydown={(event) => onTabKeydown(event, tab.id)}
		>
			<span
				class={cn(
					'inline-flex size-6 shrink-0 items-center justify-center rounded-full',
					selected ? styles.iconActive : styles.iconIdle
				)}
				aria-hidden="true"
			>
				<Heart class="size-3.5 fill-current" strokeWidth={0} />
			</span>
			<span>{tab.label}</span>
			{#if badgeText}
				<Badge
					class="absolute -top-1 -right-1 z-10 min-w-5 justify-center border border-white px-1 py-0 text-[0.625rem] dark:border-zinc-950"
				>
					{badgeText}
				</Badge>
			{/if}
		</button>
	{/each}
</div>
