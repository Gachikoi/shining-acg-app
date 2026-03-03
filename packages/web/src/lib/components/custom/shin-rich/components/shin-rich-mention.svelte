<!--
	@component ShinRichMention
	@description @ 用户展示片段（内部组件，由 ShinRichTextarea 使用）
	@internal 主要用于模板 clone，也可用于自定义 mention 渲染

	## 概述
	渲染单个 @ 用户标签，蓝色可点击样式。ShinRichTextarea 通过隐藏模板 + cloneNode 生成
	插入到 contenteditable 的 mention 节点。

	## 点击跳转
	此部分在 rich-textarea-controller.ts 中进行了事件委托处理，具体见 rich-textarea-controller.ts 中的 handleContainerClick 方法；默认点击是无行为的，需要在上层组件 ShinRichTextarea 中注入 onMentionClick 回调函数，具体见 ShinRichTextarea 注释。

	## Props
	- user: MentionUser，显示 remark ?? name
-->

<script lang="ts">
	import type { MentionUser } from './shin-rich-popover.svelte';

	type Props = {
		user: MentionUser;
	};

	let { user }: Props = $props();
</script>

<span
	contenteditable="false"
	data-mention-user-id={user.id}
	class="cursor-pointer text-blue-500 hover:text-blue-600"
>
	@{user.remark ?? user.name}
</span>
