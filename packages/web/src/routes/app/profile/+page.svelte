<script lang="ts">
	import { toast } from 'svelte-sonner';
	import ProfileShell from './components/profile-shell.svelte';
	import ProfileHeader from './components/header/profile-header.svelte';
	import ContentTabs from './components/content/content-tabs.svelte';
	import ContentGrid from './components/content/content-grid.svelte';
	import { MOCK_POSTS_BY_TAB, MOCK_PROFILE_OWNER } from './components/mock-data';
	import type {
		ProfileActionId,
		ProfileContentTabId,
		ProfilePostCard,
		ProfileStatId
	} from './components/types';

	let owner = $state(structuredClone(MOCK_PROFILE_OWNER));
	let activeTab = $state<ProfileContentTabId>('favorites');
	let menuOpen = $state(false);
	let postsByTab = $state<Record<ProfileContentTabId, ProfilePostCard[]>>(
		structuredClone(MOCK_POSTS_BY_TAB)
	);

	const gridItems = $derived(postsByTab[activeTab]);

	function handleTabChange(tabId: ProfileContentTabId) {
		// TODO: 仅当 viewerId === profileOwnerId 时展示 favorites/likes 网格，否则空态或隐藏
		activeTab = tabId;
	}

	function handleStatClick(_id: ProfileStatId) {
		void _id;
		// TODO: 对接关注/粉丝/获赞列表路由
		toast.message('暂未开放');
	}

	function handleSocialClick(_linkId: string) {
		void _linkId;
		// TODO: 对接真实外链跳转或链接编辑
		toast.message('暂未开放');
	}

	function handleAction(actionId: ProfileActionId) {
		if (actionId === 'share') {
			const url = typeof window !== 'undefined' ? window.location.href : '';
			void navigator.clipboard.writeText(url).then(
				() => toast.message('已复制链接'),
				() => {
					// TODO: 分享失败埋点 / 降级 UI
					toast.message('复制失败');
				}
			);
			return;
		}
		// TODO: 打开 modify-nickname / identity-auth 等弹窗（见 .design/profile sibling）
		toast.message('暂未开放');
	}

	function handleOpenPost(_postId: string) {
		void _postId;
		// TODO: 对接帖子详情路由
		toast.message('暂未开放');
	}

	function handleToggleLike(postId: string) {
		// TODO: 对接点赞 API；当前仅本地 Mock 切换
		const list = postsByTab[activeTab];
		const idx = list.findIndex((p) => p.id === postId);
		if (idx < 0) return;
		const item = list[idx];
		const liked = !item.liked;
		list[idx] = {
			...item,
			liked,
			likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1))
		};
		postsByTab = { ...postsByTab, [activeTab]: [...list] };
	}

	// TODO: 仅当 viewerId === profileOwnerId 时展示 favorites/likes 网格，否则空态或隐藏
	const visibleGridItems = $derived(gridItems);
</script>

<ProfileShell>
	{#snippet header()}
		<ProfileHeader
			{owner}
			bind:menuOpen
			onStatClick={handleStatClick}
			onSocialClick={handleSocialClick}
			onAction={handleAction}
		/>
	{/snippet}
	{#snippet content()}
		<div class="flex flex-col gap-4">
			<ContentTabs bind:activeTab onTabChange={handleTabChange} />
			<ContentGrid
				items={visibleGridItems}
				{activeTab}
				onOpenPost={handleOpenPost}
				onToggleLike={handleToggleLike}
			/>
		</div>
	{/snippet}
</ProfileShell>
