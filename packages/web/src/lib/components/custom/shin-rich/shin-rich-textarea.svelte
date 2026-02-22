<!--
	@component ShinRichTextarea
	@description 富文本输入框，支持换行、@ 用户、字数统计
	@status 开发中，因依赖未就绪暂未完全对接

	## 概述
	基于 contenteditable 的富文本输入框，用于正文描述等场景。支持回车换行、粘贴、字数统计，
	以及 @ 用户（点击按钮或输入 @ 触发，支持键盘导航与搜索过滤）。

	## Props
	- contentEditableRef: 可绑定的 contenteditable 根元素引用
	- class: 容器样式类名
	- placeholder: 占位文案
	- maxLength: 最大字数，默认 10000
-->

<script lang="ts">
	import { cn } from '$lib/utils';
	import Button from '$lib/components/ui/button/button.svelte';
	import ShinRichPopover, {
		type MentionUser
	} from '$lib/components/custom/shin-rich/shin-rich-popover.svelte';
	import ShinRichMention from '$lib/components/custom/shin-rich/shin-rich-mention.svelte';
	import logo from '$lib/assets/logo.png';
	import { filterUsersByQuery } from '$lib/components/custom/shin-rich/constants';
	import { RichTextareaController } from '$lib/components/custom/shin-rich/rich-textarea-controller';

	type Props = {
		contentEditableRef?: HTMLDivElement | null;
		class?: string;
		placeholder?: string;
		maxLength?: number;
	};

	let {
		contentEditableRef = $bindable(null),
		class: className,
		placeholder = '请输入内容',
		maxLength = 10000,
		...restProps
	}: Props = $props();

	let isEmpty = $state(true);
	let wordCount = $state(0);
	let popoverOpen = $state(false);
	let popoverPosition = $state({ left: 0, top: 0 });
	let selectedIndex = $state(0);
	let atButtonRef = $state<HTMLSpanElement | null>(null);
	let editorContainerRef = $state<HTMLDivElement | null>(null);
	let searchQuery = $state('');
	let mentionTemplateRef = $state<HTMLDivElement | null>(null);
	let mentionTemplateUser = $state<MentionUser | null>(null);

	const MOCK_USERS: MentionUser[] = [
		{ id: '1', avatar: logo, name: '张三张三张三张三张三张三张三张三张三张三', qq: '11111111' },
		{ id: '2', avatar: logo, name: '李四李四李四李四李四李四李四李四李四李四', qq: '22222222' },
		{ id: '3', avatar: logo, name: '王五王五王五王五王五王五王五王五王五王五', qq: '33333333' },
		{ id: '4', avatar: logo, name: '赵六赵六赵六赵六赵六赵六赵六赵六赵六赵六', qq: '44444444' },
		{ id: '5', avatar: logo, name: '孙七孙七孙七孙七孙七孙七孙七孙七孙七孙七', qq: '55555555' },
		{ id: '6', avatar: logo, name: '周八周八周八周八周八周八周八周八周八周八', qq: '66666666' },
		{ id: '7', avatar: logo, name: '吴九吴九吴九吴九吴九吴九吴九吴九吴九吴九', qq: '77777777' },
		{ id: '8', avatar: logo, name: '郑十郑十郑十郑十郑十郑十郑十郑十郑十郑十', qq: '88888888' }
	];

	let filteredUserList = $derived(filterUsersByQuery(MOCK_USERS, searchQuery));

	// 控制器
	const controller = new RichTextareaController({
		getContentEditableRef: () => contentEditableRef,
		getMentionTemplateRef: () => mentionTemplateRef,
		getAtButtonRef: () => atButtonRef,
		getEditorContainerRef: () => editorContainerRef,
		getPopoverOpen: () => popoverOpen,
		getSelectedIndex: () => selectedIndex,
		getSearchQuery: () => searchQuery,
		getFilteredUserList: () => filteredUserList,
		getMaxLength: () => maxLength,
		setMentionTemplateUser: (v) => (mentionTemplateUser = v),
		setEmpty: (v) => (isEmpty = v),
		setWordCount: (v) => (wordCount = v),
		setPopoverOpen: (v) => (popoverOpen = v),
		setPopoverPosition: (v) => (popoverPosition = v),
		setSelectedIndex: (v) => (selectedIndex = v),
		setSearchQuery: (v) => (searchQuery = v)
	});
</script>

<!-- 隐藏模板，用于 clone 生成 mention 元素 -->
<div bind:this={mentionTemplateRef} class="sr-only" aria-hidden="true">
	{#if mentionTemplateUser}
		<ShinRichMention user={mentionTemplateUser} />
	{/if}
</div>

<div bind:this={editorContainerRef} class="relative">
	<div
		class={cn(
			'relative min-h-[80px] w-full cursor-text rounded-2xl border-0 bg-zinc-100 px-3 pt-2 pb-8 text-base caret-primary shadow-xs ring-offset-background transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900',
			className
		)}
		onclick={(e) => controller.handleContainerClick(e)}
		{...restProps}
	>
		<div
			class="pointer-events-none absolute top-2 left-3 text-muted-foreground"
			class:hidden={!isEmpty}
		>
			{placeholder}
		</div>
		<div
			contentEditable="true"
			role="textbox"
			tabindex="0"
			class="min-h-12 outline-none"
			bind:this={contentEditableRef}
			onkeydown={(e) => controller.handleKeydown(e)}
			oninput={(e) => controller.handleRichTextareaInput(e)}
			onpaste={(e) => controller.handlePaste(e)}
		></div>
		<div class="absolute right-3 bottom-2 text-muted-foreground">
			{wordCount}/{maxLength}
		</div>
	</div>

	<span bind:this={atButtonRef} class="mt-4 inline-block">
		<Button
			variant="block"
			type="button"
			class="rounded-3xl px-3 py-1.5 text-accent-foreground"
			onclick={() => controller.handleAtButtonClick()}
		>
			@ 用户
		</Button>
	</span>
</div>
<ShinRichPopover
	bind:open={popoverOpen}
	bind:selectedIndex
	userList={filteredUserList}
	position={popoverPosition}
	onSelect={(user) => controller.handlePopoverSelect(user)}
	onClose={() => controller.handlePopoverClose()}
	onClickOutside={() => controller.handlePopoverClose()}
	ignoreClickRef={editorContainerRef}
/>
