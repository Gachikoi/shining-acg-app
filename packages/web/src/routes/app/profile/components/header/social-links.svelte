<script lang="ts">
	import type { ProfileSocialLink } from '../types';

	let {
		links,
		onSocialClick
	}: {
		links: ProfileSocialLink[];
		onSocialClick: (linkId: string) => void;
	} = $props();
</script>

{#if links.length > 0}
	<div class="flex flex-wrap items-center gap-3">
		{#each links as link (link.id)}
			<button
				type="button"
				class="inline-flex min-h-11 items-center text-sm font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
				onclick={() => onSocialClick(link.id)}
			>
				{link.label}
			</button>
		{/each}
	</div>
{/if}
