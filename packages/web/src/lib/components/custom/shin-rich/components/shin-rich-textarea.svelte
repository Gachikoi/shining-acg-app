<!--
	@component ShinRichTextarea
	@description 富文本输入框，支持换行、@ 用户、字数统计
	@status 已对接 fetchMentionUsers、onMentionClick；无 fetchMentionUsers 时使用 MOCK 兜底

	## 概述
	基于 contenteditable 的富文本输入框，用于正文描述等场景。支持回车换行、粘贴、字数统计，
	以及 @ 用户（点击按钮或输入 @ 触发，支持键盘导航与搜索过滤）。

	## 功能特性
	- 换行：Enter 插入 br+ZWSP，粘贴时 \n 自动转为 br+ZWSP
	- @ 提及：点击「@ 用户」按钮或输入 @ 打开用户选择弹层，支持上下键切换、Enter 确认、Escape 关闭
	- 搜索过滤：输入 @ 后继续输入可过滤用户列表（按 qq、name、remark）
	- 字数统计：右下角显示当前字数 / 最大字数
	- Backspace：mention 整块删除、br+ZWSP 整行删除、删除 @ 时关闭 popover

	## Props
	- contentEditableRef: 可绑定的 contenteditable 根元素引用，用于外部获取 DOM 或调用 extractContentFromShinRichTextarea
	- class: 容器样式类名
	- placeholder: 占位文案
	- maxLength: 最大字数，默认 10000
	- onMentionClick: 点击 mention 时的回调，用于跳转个人资料页等

	## 使用示例

	### 基础用法
	```svelte
	<script>
		import { ShinRichTextarea } from '$lib/components/custom/shin-rich';

		let contentEditableRef = $state<HTMLDivElement | null>(null);
	</script>

	<ShinRichTextarea
		placeholder="添加帖子描述"
		class="mt-5"
		bind:contentEditableRef
	/>
	```

	### 提取内容为 API 格式
	```svelte
	<script>
		import ShinRichTextarea, { extractContentFromShinRichTextarea } from '$lib/components/custom/shin-rich';
		import type { V1PostContentUnit } from '$lib/api/types.gen';

		let contentEditableRef = $state<HTMLDivElement | null>(null);

		function handleSubmit() {
			if (!contentEditableRef) return;
			const units: V1PostContentUnit[] = extractContentFromShinRichTextarea(contentEditableRef);
			// units 为 { type: 'text', content } 与 { type: 'mention', user_id, name } 的数组
			console.log(units);
		}
	</script>

	<ShinRichTextarea bind:contentEditableRef placeholder="请输入" />
	<button onclick={handleSubmit}>提交</button>
	```

	### 点击 mention 跳转个人资料
	```svelte
	<script>
		import { goto } from '$app/navigation';
		import { ShinRichTextarea } from '$lib/components/custom/shin-rich';

		function onMentionClick(userId: string) {
			goto(`/app/profile/${userId}`);
		}
	</script>

	<ShinRichTextarea onMentionClick={onMentionClick} placeholder="@ 提及用户" />
	```

	### 自定义最大字数
	```svelte
	<ShinRichTextarea maxLength={500} placeholder="最多 500 字" />
	```

	## 依赖说明
	- 用户列表：传入 fetchMentionUsers 时从关注列表获取 20 人，有输入时前端 filter；未传入时使用 MOCK
	- 支持按 QQ 号、用户昵称、备注查找；@ 标识显示蓝色，点击进入个人资料页依赖 onMentionClick
-->

<script lang="ts">
	import { cn } from '$lib/utils';
	import Button from '$lib/components/ui/button/button.svelte';
	import { AtSign } from 'lucide-svelte';
	import ShinRichPopover, { type MentionUser } from './shin-rich-popover.svelte';
	import ShinRichMention from './shin-rich-mention.svelte';
	import logo from '$lib/assets/logo.png';
	import { filterUsersByQuery } from '../utils/filter-users';
	import { RichTextareaController } from '../controller/rich-textarea-controller';
	import {
		renderUnitsToHtml,
		isEffectivelyEmpty,
		getTextLengthWithNewlines
	} from '../utils/contenteditable';
	import type { V1PostContentUnit } from '$lib/api/types.gen';

	type Props = {
		contentEditableRef?: HTMLDivElement | null;
		class?: string;
		placeholder?: string;
		maxLength?: number;
		/** 初始内容，用于草稿恢复 */
		initialContent?: V1PostContentUnit[];
		/** 点击 mention 时的回调，用于跳转个人资料页等 */
		onMentionClick?: (userId: string) => void;
		/** 获取用户列表的函数，用于 @ 提及功能 */
		fetchMentionUsers?: (query: string) => Promise<MentionUser[]>;
		/** @ 按钮是否显示为图标（默认文字按钮） */
		atButtonIconOnly?: boolean;
	};

	let {
		contentEditableRef = $bindable(null),
		class: className,
		placeholder = '请输入内容',
		maxLength = 10000,
		initialContent,
		onMentionClick,
		fetchMentionUsers,
		atButtonIconOnly = false,
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

	let userList = $state<MentionUser[]>(MOCK_USERS);

	$effect(() => {
		if (fetchMentionUsers) {
			fetchMentionUsers(searchQuery).then((users) => {
				userList = users ?? [];
			});
		} else {
			userList = MOCK_USERS;
		}
	});

	let filteredUserList = $derived(filterUsersByQuery(userList, searchQuery));

	// 草稿恢复：contenteditableRef 就绪且有 initialContent 时注入
	$effect(() => {
		const el = contentEditableRef;
		const content = initialContent;
		if (!el || !content || content.length === 0) return;
		// 仅当内容为空时注入，避免覆盖用户已输入内容
		if (!isEffectivelyEmpty(el)) return;
		el.innerHTML = renderUnitsToHtml(content);
		isEmpty = isEffectivelyEmpty(el);
		wordCount = getTextLengthWithNewlines(el);
	});

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
		getOnMentionClick: () => onMentionClick,
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
		<!-- 已知桌面端 bug: 当一直输入一个字母或者数字时，会把容器横向撑大，不会自动换行。wrap-break-word 没有效果，目前暂时无法解决。并且解决优先度低，因为这个 bug 只在输入长数字和英文时发生，且只在桌面端出现 -->
		<div
			contentEditable="true"
			role="textbox"
			tabindex="0"
			class="min-h-12 wrap-break-word outline-none"
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
			class={cn(
				'rounded-3xl px-3 py-1.5 text-accent-foreground',
				atButtonIconOnly && 'min-h-9 min-w-9 rounded-full p-0'
			)}
			onclick={() => controller.handleAtButtonClick()}
		>
			{#if atButtonIconOnly}
				<AtSign class="size-4" />
			{:else}
				@ 用户
			{/if}
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
