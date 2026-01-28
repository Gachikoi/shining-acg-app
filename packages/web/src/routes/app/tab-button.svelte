<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type { ComponentType, SvelteComponent } from 'svelte';

	let {
		class: className,
		badgeText,
		text,
		img,
		href,
		type,
		icon: Icon
	}: {
		class?: string;
		badgeText?: string;
		text: string;
		img?: string;
		href?: string;
		type?: string;
		icon?: ComponentType<SvelteComponent>;
	} = $props();

	let isSelected = $derived(page.url.pathname === href);
</script>

{#if href}
	<a
		title={href}
		href={resolve(href as Parameters<typeof resolve>[0])}
		data-sveltekit-preload-code="eager"
		data-sveltekit-replacestate
		data-sveltekit-preload-data="tap">{@render button(type)}</a
	>
{:else}{@render button()}{/if}

{#snippet button(type?: string)}
	{#if type === 'mobile'}
		<div class="relative px-2">
			<div
				class={cn(
					'text-base font-medium text-zinc-500',
					isSelected && 'font-semibold text-zinc-900 dark:text-zinc-100'
				)}
			>
				{text}
			</div>
			<!-- 传入空格，说明显示不带具体消息条目的点状徽章 -->
			{#if badgeText === ' '}
				<Badge class="absolute -top-0.75 left-8.25 p-1.5" variant="dot"></Badge>
			{:else if badgeText}
				<Badge class="absolute -top-1.5 left-8.25 min-w-3.75 px-1 py-0 text-[0.625rem]/3.25"
					>{badgeText}</Badge
				>
			{/if}
		</div>
	{:else}
		<Button
			class={cn(
				'h-12 w-46 justify-between rounded-full px-4 xl:w-56',
				className,
				isSelected && 'bg-zinc-100 dark:bg-zinc-900'
			)}
			variant="ghost"
		>
			<div class="flex items-center gap-3">
				{#if img}
					<img src={img} alt={text} class="size-6 rounded-full" />
				{:else}
					<Icon class="size-6" strokeWidth={1.8} />
				{/if}
				<span class="text-base font-semibold">{text}</span>
			</div>
			<!-- 传入空格，说明显示不带具体消息条目的点状徽章 -->
			{#if badgeText === ' '}
				<Badge variant="dot"></Badge>
			{:else if badgeText}
				<Badge class="min-w-5">{badgeText}</Badge>
			{/if}
		</Button>
	{/if}
{/snippet}
