<script lang="ts">
	import { cn } from '$lib/utils';
	import { ScrollBadgeRow, VerifiedTitleBadge } from '$lib/components/custom/user-badge-row';

	let {
		userId,
		nickname,
		avatarUrl,
		online = false,
		verifiedTitle,
		tags = [],
		interactive = false,
		avatarOnly = false,
		onUserClick
	}: {
		userId: string;
		nickname: string;
		avatarUrl?: string;
		online?: boolean;
		verifiedTitle?: string;
		tags?: string[];
		interactive?: boolean;
		avatarOnly?: boolean;
		onUserClick?: (userId: string) => void;
	} = $props();

	let imageFailed = $state(false);

	const accessibleName = $derived(`${nickname}${online ? '，在线' : ''}`);

	function handleClick() {
		if (!interactive || !onUserClick) return;
		onUserClick(userId);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!interactive || !onUserClick) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onUserClick(userId);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={cn(
		'flex min-w-0 items-start gap-3',
		!avatarOnly && 'min-h-11',
		interactive &&
			'cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-red-500'
	)}
	role={interactive ? 'button' : undefined}
	tabindex={interactive ? 0 : undefined}
	aria-label={accessibleName}
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	<div class="relative shrink-0">
		{#if avatarUrl && !imageFailed}
			<img
				src={avatarUrl}
				alt=""
				class="size-12 rounded-full bg-zinc-900 object-cover"
				onerror={() => {
					imageFailed = true;
				}}
			/>
		{:else}
			<div
				class="flex size-12 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white"
				aria-hidden="true"
			>
				{nickname.slice(0, 1)}
			</div>
		{/if}
		{#if online}
			<span
				class="absolute right-0 bottom-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950"
				aria-hidden="true"
			></span>
		{/if}
	</div>

	{#if !avatarOnly}
		<div class="min-w-0 flex-1">
			<div class="flex min-w-0 items-center gap-2">
				<span class="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50"
					>{nickname}</span
				>
				{#if verifiedTitle}
					<VerifiedTitleBadge title={verifiedTitle} />
				{/if}
			</div>
			{#if tags.length > 0}
				<ScrollBadgeRow ariaLabel="用户标签" class="mt-1 gap-1.5">
					{#each tags as tag (tag)}
						<span
							class="shrink-0 truncate rounded border border-red-200 px-1.5 text-xs text-red-400 dark:border-red-500/40 dark:text-red-400"
						>
							{tag}
						</span>
					{/each}
				</ScrollBadgeRow>
			{/if}
		</div>
	{/if}
</div>
