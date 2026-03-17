<!--
  @component PostDetail 组件调试页
  用于在无后端的情况下预览 PostDetail 全部子组件（含 ImageVideoPreview、CommentSection、EditCommentPopover）。

  使用方式：访问 /app/home/post-detail-debug 即可查看。

  Mock 策略：
  - PostDetail 通过 `post` prop 直传 mock 数据，跳过 API 获取
  - 评论区通过 `comments` snippet 注入带 `useMock` 的 CommentSection
  - 点赞/收藏/关注等交互在无后端时会静默失败并回滚，不影响 UI 预览
-->
<script lang="ts">
	import { PostDetail } from '$lib/components/custom/post-detail';
	import CommentSection from '$lib/components/custom/comment-section/comment-section.svelte';
	import { Button } from '$lib/components/ui/button';
	import { postDetailMockBundle, getMockPost, getMockPostComments } from '$lib/test/post-detail';
	import type { V1Post as Post, V1CommentWithReplies } from '$lib/api';

	let showDetail = $state(false);

	let mockPost = $state<Post>(postDetailMockBundle.post);
	let mockComments = $state<V1CommentWithReplies[]>(postDetailMockBundle.mockComments);

	function regenerateMockData() {
		const id = `debug-${crypto.randomUUID().slice(0, 8)}`;
		mockPost = getMockPost(id);
		mockComments = getMockPostComments(id);
	}
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 p-6">
	<h1 class="text-lg font-semibold">PostDetail 组件调试</h1>
	<p class="max-w-md text-center text-sm text-zinc-500">
		点击下方按钮打开帖子详情弹窗。所有数据均为 mock，无需后端。
		交互操作（点赞/收藏/关注/评论提交）会静默失败并回滚，不影响 UI 测试。
	</p>

	<div class="flex gap-3">
		<Button onclick={() => (showDetail = true)}>打开帖子详情</Button>
		<Button
			variant="secondary"
			onclick={() => {
				regenerateMockData();
				showDetail = true;
			}}
		>
			重新生成并打开
		</Button>
	</div>

	<div
		class="mt-4 max-w-md rounded-lg border border-zinc-200 p-4 text-xs text-zinc-500 dark:border-zinc-700"
	>
		<p class="mb-2 font-medium text-zinc-700 dark:text-zinc-300">覆盖测试点：</p>
		<ul class="list-inside list-disc space-y-1">
			<li>媒体区：多图/视频切换、页码、全屏预览（ImageVideoPreview）</li>
			<li>作者信息：头像、昵称、部门徽章、认证标识</li>
			<li>正文：标题、长内容折叠「查看全文/收起内容」</li>
			<li>评论区：最热/最新排序、多级回复、展开/收起、长评论折叠（CommentSection）</li>
			<li>评论编辑器：回复引用、字数限制（EditCommentPopover）</li>
			<li>底部操作栏：点赞、收藏、评论、分享</li>
		</ul>
	</div>
</div>

{#if showDetail}
	<PostDetail post={mockPost} onClose={() => (showDetail = false)}>
		{#snippet comments({ postId, currentUserId, initialCount, onReply, onTotalCountChange })}
			<CommentSection
				{postId}
				{currentUserId}
				{initialCount}
				useMock={true}
				{mockComments}
				{onReply}
				{onTotalCountChange}
			/>
		{/snippet}
	</PostDetail>
{/if}
