<script lang="ts">
	import { VerifiedTitleBadge, DepartmentBadge } from '$lib/components/custom/user-badge-row';

	let {
		avatarUrl,
		displayName,
		verifiedTitle,
		tags = [],
		qq
	}: {
		avatarUrl?: string;
		displayName: string;
		verifiedTitle?: string;
		tags?: string[];
		qq?: string;
	} = $props();

	let avatarFailed = $state(false);

	$effect(() => {
		void avatarUrl;
		avatarFailed = false;
	});
</script>

<div class="flex items-start gap-4">
	{#if avatarUrl && !avatarFailed}
		<img
			src={avatarUrl}
			alt=""
			class="size-20 shrink-0 rounded-full bg-zinc-200 object-cover sm:size-24 dark:bg-zinc-700"
			onerror={() => {
				avatarFailed = true;
			}}
		/>
	{:else}
		<div
			class="flex size-20 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-500 sm:size-24 dark:bg-zinc-700 dark:text-zinc-300"
			aria-hidden="true"
		>
			{displayName.slice(0, 1)}
		</div>
	{/if}

	<div class="min-w-0 flex-1 space-y-2">
		<div class="flex min-w-0 flex-wrap items-center gap-1.5">
			<h1 class="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-50">
				{displayName}
			</h1>
			{#if verifiedTitle}
				<VerifiedTitleBadge title={verifiedTitle} />
			{/if}
		</div>

		{#if tags.length > 0}
			<div class="flex flex-wrap items-center gap-1.5">
				{#each tags as tag, i (i)}
					<DepartmentBadge name={tag} />
				{/each}
			</div>
		{/if}

		{#if qq}
			<p class="text-sm text-zinc-500 dark:text-zinc-400">QQ号：{qq}</p>
		{/if}
	</div>
</div>
