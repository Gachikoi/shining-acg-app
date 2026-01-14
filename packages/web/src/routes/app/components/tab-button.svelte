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
	} = $props<{
		class?: string;
		badgeText?: string;
		text: string;
		img?: string;
		href?: string;
		type?: string;
		icon?: ComponentType<SvelteComponent>;
	}>();

	let isSelected = $derived(page.url.pathname === href);
</script>

{#if href}
	<a
		title={href}
		href={resolve(href)}
		data-sveltekit-preload-code="eager"
		data-sveltekit-replacestate
		data-sveltekit-preload-data="tap">{@render button(type)}</a
	>
{:else}{@render button()}{/if}

{#snippet button(type?: string)}
	{#if type === 'mobile'}
		<div class="relative">
			<div
				class={cn(
					'text-base font-medium text-zinc-500 dark:text-zinc-400',
					isSelected && 'font-semibold text-zinc-900 dark:text-zinc-100'
				)}
			>
				{text}
			</div>
			{#if badgeText}
				<Badge class="absolute -top-2 left-6 px-1 py-0 text-[0.625rem]/3.25">{badgeText}</Badge>
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
			{#if badgeText}
				<Badge>{badgeText}</Badge>
			{/if}
		</Button>
	{/if}
{/snippet}
