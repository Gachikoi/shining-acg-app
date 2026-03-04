<script lang="ts">
	import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import { cn } from '$lib/utils.js';

	let {
		value = $bindable(''),
		placeholder = '选择日期',
		disabled = false,
		class: className
	}: {
		/** ISO: YYYY-MM-DD */
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	} = $props();

	let open = $state(false);

	const today = new Date();

	function parseValue(v: string): Date | null {
		if (!v) return null;
		const [y, m, d] = v.split('-').map((x) => Number(x));
		if (!y || !m || !d) return null;
		const dt = new Date(Date.UTC(y, m - 1, d));
		return Number.isNaN(dt.getTime()) ? null : dt;
	}

	function formatValue(date: Date): string {
		const y = date.getUTCFullYear();
		const m = String(date.getUTCMonth() + 1).padStart(2, '0');
		const d = String(date.getUTCDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function formatDisplay(date: Date | null): string {
		if (!date) return placeholder;
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: '2-digit',
			timeZone: 'UTC'
		}).format(date);
	}

	let selected = $state<Date | null>(value ? parseValue(value) : null);
	let viewYear = $state(selected?.getUTCFullYear() ?? today.getUTCFullYear());
	let viewMonth = $state(selected?.getUTCMonth() ?? today.getUTCMonth()); // 0-based

	// 外部字符串同步
	$effect(() => {
		value = selected ? formatValue(selected) : '';
	});

	const displayText = $derived(formatDisplay(selected));

	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	type CalendarCell = {
		date: Date;
		currentMonth: boolean;
	};

	function buildCalendar(year: number, month: number): CalendarCell[][] {
		const firstOfMonth = new Date(Date.UTC(year, month, 1));
		const firstWeekday = firstOfMonth.getUTCDay(); // 0-6, Sunday first
		const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
		const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

		const cells: CalendarCell[] = [];

		// 前一月补齐
		for (let i = firstWeekday - 1; i >= 0; i--) {
			const day = daysInPrevMonth - i;
			cells.push({
				date: new Date(Date.UTC(year, month - 1, day)),
				currentMonth: false
			});
		}

		// 当月
		for (let d = 1; d <= daysInMonth; d++) {
			cells.push({
				date: new Date(Date.UTC(year, month, d)),
				currentMonth: true
			});
		}

		// 下一月补齐到 6 行
		let nextDay = 1;
		while (cells.length < 42) {
			cells.push({
				date: new Date(Date.UTC(year, month + 1, nextDay++)),
				currentMonth: false
			});
		}

		const weeks: CalendarCell[][] = [];
		for (let i = 0; i < cells.length; i += 7) {
			weeks.push(cells.slice(i, i + 7));
		}
		return weeks;
	}

	const weeks = $derived(buildCalendar(viewYear, viewMonth));

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear -= 1;
		} else {
			viewMonth -= 1;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear += 1;
		} else {
			viewMonth += 1;
		}
	}

	function isSameDay(a: Date, b: Date) {
		return (
			a.getUTCFullYear() === b.getUTCFullYear() &&
			a.getUTCMonth() === b.getUTCMonth() &&
			a.getUTCDate() === b.getUTCDate()
		);
	}
</script>

<Popover.Popover bind:open>
	<Popover.PopoverTrigger {disabled} class={cn('w-full', className)} aria-label="选择日期">
		<Button
			variant="tertiary"
			size="default"
			class={cn(
				'flex h-9 w-full items-center justify-between rounded-full border-0 bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-900 shadow-xs hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800',
				!selected && 'text-zinc-500'
			)}
			{disabled}
		>
			<span class="truncate text-left">{displayText}</span>
			<CalendarIcon class="size-4 shrink-0 text-zinc-400" />
		</Button>
	</Popover.PopoverTrigger>

	<Popover.PopoverContent class="w-[17.5rem] p-3">
		<div class="flex items-center justify-between pb-2">
			<button
				type="button"
				class="flex size-7 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
				onclick={prevMonth}
			>
				<ChevronLeft class="size-4 text-zinc-500" />
			</button>
			<div class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
				{viewYear} 年 {viewMonth + 1} 月
			</div>
			<button
				type="button"
				class="flex size-7 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
				onclick={nextMonth}
			>
				<ChevronRight class="size-4 text-zinc-500" />
			</button>
		</div>

		<div class="grid grid-cols-7 gap-1 pb-1 text-center text-xs text-zinc-500">
			{#each WEEKDAYS as w, i (i)}
				<div>{w}</div>
			{/each}
		</div>

		<div class="grid grid-cols-7 gap-1">
			{#each weeks as week, weekIndex (weekIndex)}
				{#each week as cell (cell.date.getTime())}
					{@const isSelected = selected && isSameDay(selected, cell.date)}
					{@const isToday = isSameDay(cell.date, today)}
					<button
						type="button"
						onclick={() => {
							selected = cell.date;
							open = false;
						}}
						class={cn(
							'flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors',
							!cell.currentMonth && 'text-zinc-400',
							cell.currentMonth && 'text-zinc-900 dark:text-zinc-100',
							isToday && 'border border-zinc-300 dark:border-zinc-700',
							isSelected &&
								'bg-zinc-900 text-white hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900',
							!isSelected && 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
						)}
					>
						{cell.date.getUTCDate()}
					</button>
				{/each}
			{/each}
		</div>
	</Popover.PopoverContent>
</Popover.Popover>
