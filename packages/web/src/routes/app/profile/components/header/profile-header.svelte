<script lang="ts">
	import Identity from './identity.svelte';
	import Stats from './stats.svelte';
	import SocialLinks from './social-links.svelte';
	import ActionMenu from './action-menu.svelte';
	import type { ProfileActionId, ProfileOwner, ProfileStatId } from '../types';

	let {
		owner,
		menuOpen = $bindable(false),
		onStatClick,
		onSocialClick,
		onAction
	}: {
		owner: ProfileOwner;
		menuOpen?: boolean;
		onStatClick: (id: ProfileStatId) => void;
		onSocialClick: (linkId: string) => void;
		onAction: (actionId: ProfileActionId) => void;
	} = $props();
</script>

<div class="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
	<div class="absolute top-0 right-0 sm:static sm:order-last sm:ml-auto">
		<ActionMenu bind:open={menuOpen} {onAction} />
	</div>

	<div class="min-w-0 flex-1 space-y-3 pr-12 sm:pr-0">
		<Identity
			avatarUrl={owner.avatarUrl}
			displayName={owner.displayName}
			verifiedTitle={owner.verifiedTitle}
			tags={owner.tags}
			qq={owner.qq}
		/>
		<Stats
			followingCount={owner.followingCount}
			followersCount={owner.followersCount}
			likesCollectCount={owner.likesCollectCount}
			{onStatClick}
		/>
		<SocialLinks links={owner.socialLinks} {onSocialClick} />
	</div>
</div>
