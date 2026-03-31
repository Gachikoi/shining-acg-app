<!--
  PostDetail 调试页（无后端）

  路由：开发环境打开 /app/home/post-detail-debug（生产域名即 /home/post-detail-debug）。

  本页涉及的模块说明（便于对照源码）：
  - PostDetail（$lib/components/custom/post-detail）
      帖子详情壳：拉帖、作者区、正文、底部互动、挂载评论区与评论编辑器。
  - post-media-area.svelte
      帖内多图/视频轮播；点击媒体进入全屏预览。
  - ImageVideoPreview（$lib/components/custom/image-video-preview）
      全屏查看 V1MediaAsset 列表；图片横滑 + 视频控制，依赖 media-url 解析地址。
  - CommentSection
      一级评论列表、最热/最新、回复展开、删除/举报等（经 PostDetailApi）。
  - EditCommentPopover
      发评/回复：富文本、@、图片草稿；提交走同一套 Mock API。
  - time.ts / media-url.ts
      详情里相对时间与媒体 URL 与线上一致，Mock 不绕开这两处工具。

  Mock：createMockPostDetailApi(postId) 注入 PostDetail 的 api 属性；数据在内存中变更，可重复打开「重新生成并打开」换新会话。
-->
<script lang="ts">
	import { PostDetail, createMockPostDetailApi } from '$lib/components/custom/post-detail';
	import { Button } from '$lib/components/ui/button';

	let showDetail = $state(false);

	const initialId = `debug-${crypto.randomUUID().slice(0, 8)}`;
	let mockPostId = $state(initialId);
	let mockApi = $state(createMockPostDetailApi(initialId));

	function regenerateAndOpen() {
		const id = `debug-${crypto.randomUUID().slice(0, 8)}`;
		mockPostId = id;
		mockApi = createMockPostDetailApi(id);
		showDetail = true;
	}
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 p-6">
	<h1 class="text-lg font-semibold">PostDetail 组件调试</h1>
	<p class="max-w-md text-center text-sm text-zinc-500">
		点击下方按钮打开帖子详情弹窗。所有数据均为 mock，无需后端。
		交互操作（点赞/收藏/关注/评论提交/删除）均在内存中生效。
	</p>

	<div class="flex gap-3">
		<Button onclick={() => (showDetail = true)}>打开帖子详情</Button>
		<Button variant="secondary" onclick={regenerateAndOpen}>重新生成并打开</Button>
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
			<li>评论编辑器：回复引用、字数限制、图片上传（EditCommentPopover）</li>
			<li>底部操作栏：点赞、收藏、评论、分享</li>
			<li>关注按钮：关注/取消关注状态切换</li>
		</ul>
	</div>
</div>

{#if showDetail}
	<PostDetail postId={mockPostId} api={mockApi} onClose={() => (showDetail = false)} />
{/if}
