<!--
	@component
	## ShinRichTextarea - 富文本输入框组件

	⚠️ **开发中**：本组件仍在开发阶段，API 与行为可能发生变化。

	基于 Textarea 封装的富文本输入框组件，支持回车换行、粘贴、统计字数等功能。

	### 使用方式

	```svelte
	<ShinRichTextarea />
	```

	### 实现要点
	1. 统一使用 `<br>` 作为换行符，解决不同浏览器对回车行为的差异
	2. 拦截默认 Enter 换行行为，使用“零宽空格”（ZWSP）解决光标无法在换行后正确显示的浏览器历史遗留 Bug
	3. 拦截 Backspace：当光标在 `<br>`+ZWSP 之后时，一次退格即删除整行换行
	4. 多行文本：`\n` 转为 `<br>` + 零宽空格，与 Enter 行为一致
	5. 粘贴时：`\n` 转为 `<br>` + 零宽空格，与 Enter 行为一致
	6. 统计字数时：对 `<br>` 和 其他字符分别计数
	7. @ 用户：点击按钮或输入 @ 弹出用户选择，支持键盘导航与搜索过滤。
-->

<script lang="ts">
	import { tick } from 'svelte';
	import { cn } from '$lib/utils';
	import Button from '$lib/components/ui/button/button.svelte';
	import ShinRichPopover, {
		type MentionUser
	} from '$lib/components/custom/shin-rich/shin-rich-popover.svelte';
	import logo from '$lib/assets/logo.png';

	type Props = {
		contentEditableRef?: HTMLDivElement | null;
		class?: string;
		placeholder?: string;
		content?: string;
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
	let filteredUserList = $state<MentionUser[]>(MOCK_USERS);

	const ZWSP = '\u200B'; // 零宽空格，用于光标落点

	function insertTextAtCaret(target: HTMLElement, text: string): void {
		const sel = window.getSelection();
		if (!sel || !target.contains(sel.anchorNode)) return;
		let range: Range;
		if (sel.rangeCount > 0) {
			range = sel.getRangeAt(0);
			if (!target.contains(range.commonAncestorContainer)) {
				range = document.createRange();
				range.selectNodeContents(target);
				range.collapse(false);
			}
		} else {
			range = document.createRange();
			range.selectNodeContents(target);
			range.collapse(false);
		}
		range.deleteContents();
		range.insertNode(document.createTextNode(text));
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range);
	}

	function insertAtEnd(target: HTMLElement, text: string): void {
		const sel = window.getSelection();
		if (!sel) return;
		const range = document.createRange();
		range.selectNodeContents(target);
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range);
		range.deleteContents();
		range.insertNode(document.createTextNode(text));
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range);
	}

	function handleAtButtonClick() {
		const target = contentEditableRef;
		if (!target) return;
		const hasFocus = document.activeElement === target;
		if (hasFocus) {
			insertTextAtCaret(target, '@');
		} else {
			target.focus();
			insertAtEnd(target, '@');
		}
		if (atButtonRef) {
			const rect = atButtonRef.getBoundingClientRect();
			popoverPosition = { left: rect.left, top: rect.bottom + 4 };
		}
		selectedIndex = 0;
		searchQuery = '';
		filteredUserList = MOCK_USERS;
		popoverOpen = true;
		target.focus();
		target.dispatchEvent(new InputEvent('input', { bubbles: true }));
	}

	function getNodeOffsetAtCharIndex(
		root: HTMLElement,
		charIndex: number
	): { node: Node; offset: number } | null {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
		let count = 0;
		while (walker.nextNode()) {
			const node = walker.currentNode;
			const text = (node.textContent ?? '').replace(/\u200B/g, '');
			const len = text.length;
			if (count + len >= charIndex) {
				return { node, offset: charIndex - count };
			}
			count += len;
		}
		return null;
	}

	function handlePopoverSelect(user: MentionUser) {
		const target = contentEditableRef;
		if (!target) return;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const range = sel.getRangeAt(0);
		if (!target.contains(range.commonAncestorContainer)) return;
		const textBefore = getTextBeforeCaret(target);
		const atIdx = textBefore.lastIndexOf('@');
		if (atIdx >= 0) {
			const startPos = getNodeOffsetAtCharIndex(target, atIdx);
			if (startPos) {
				const deleteRange = document.createRange();
				deleteRange.setStart(startPos.node, startPos.offset);
				deleteRange.setEnd(range.startContainer, range.startOffset);
				deleteRange.deleteContents();
				const insertRange = document.createRange();
				insertRange.setStart(startPos.node, startPos.offset);
				insertRange.collapse(true);
				const txt = document.createTextNode(`@${user.name} `);
				insertRange.insertNode(txt);
				insertRange.setStartAfter(txt);
				insertRange.collapse(true);
				sel.removeAllRanges();
				sel.addRange(insertRange);
			} else {
				insertTextAtCaret(target, `@${user.name} `);
			}
		} else {
			insertTextAtCaret(target, `@${user.name} `);
		}
		popoverOpen = false;
		selectedIndex = 0;
		target.dispatchEvent(new InputEvent('input', { bubbles: true }));
	}

	function handlePopoverClose() {
		popoverOpen = false;
		selectedIndex = 0;
		searchQuery = '';
		filteredUserList = MOCK_USERS;
	}

	function filterUsersByQuery(users: MentionUser[], query: string): MentionUser[] {
		if (!query.trim()) return users;
		const q = query.trim().toLowerCase();
		return users.filter(
			(u) =>
				u.qq.toLowerCase().includes(q) ||
				u.name.toLowerCase().includes(q) ||
				(u as MentionUser & { remark?: string }).remark?.toLowerCase().includes(q)
		);
	}

	function getTextBeforeCaret(target: HTMLElement): string {
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return '';
		const range = sel.getRangeAt(0);
		if (!target.contains(range.commonAncestorContainer)) return '';
		const preRange = document.createRange();
		preRange.selectNodeContents(target);
		preRange.setEnd(range.startContainer, range.startOffset);
		return preRange.toString().replace(/\u200B/g, '');
	}

	async function openPopoverFromTypedAt(target: HTMLElement): Promise<void> {
		insertTextAtCaret(target, '@');
		target.dispatchEvent(new InputEvent('input', { bubbles: true }));
		selectedIndex = 0;
		searchQuery = '';
		filteredUserList = MOCK_USERS;

		function tryGetCaretPosition(): { left: number; top: number } | null {
			const sel = window.getSelection();
			if (!sel || sel.rangeCount === 0) return null;
			const range = sel.getRangeAt(0).cloneRange();
			if (!target.contains(range.commonAncestorContainer)) return null;
			const collapsedRect = range.getBoundingClientRect();
			if (collapsedRect.width > 0 || collapsedRect.height > 0) {
				return { left: collapsedRect.left, top: collapsedRect.bottom + 4 };
			}
			const { startContainer, startOffset } = range;
			let charRect: DOMRect | null = null;
			if (startContainer.nodeType === Node.TEXT_NODE && startOffset > 0) {
				range.setStart(startContainer, startOffset - 1);
				charRect = range.getBoundingClientRect();
				range.setStart(startContainer, startOffset);
				range.setEnd(startContainer, startOffset);
			} else if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
				const prevNode = startContainer.childNodes[startOffset - 1];
				if (prevNode) {
					range.selectNodeContents(prevNode);
					charRect = range.getBoundingClientRect();
					range.setStart(startContainer, startOffset);
					range.setEnd(startContainer, startOffset);
				}
			}
			if (charRect && (charRect.width > 0 || charRect.height > 0)) {
				return { left: charRect.right, top: charRect.bottom + 4 };
			}
			return null;
		}

		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		let pos = tryGetCaretPosition();
		if (!pos) {
			await new Promise<void>((r) => requestAnimationFrame(() => r()));
			pos = tryGetCaretPosition();
		}
		if (pos) {
			popoverPosition = pos;
		} else {
			const targetRect = target.getBoundingClientRect();
			popoverPosition = { left: targetRect.left, top: targetRect.bottom + 4 };
		}
		await tick();
		popoverOpen = true;
		target.focus();
	}

	function isEffectivelyEmpty(element: HTMLElement): boolean {
		// 移除所有 <br> 和零宽空格后若为空，则视为空
		const html = element.innerHTML
			.replace(/<br\s*\/?>/gi, '')
			.replace(/\u200B/g, '')
			.trim()
			.toLowerCase();
		if (html === '') return true;
		const text = (element.textContent ?? '').replace(/\u200B/g, '').trim();
		return text === '';
	}

	function getTextLengthWithNewlines(element: HTMLElement): number {
		// 拦截默认的回车行为，强制在光标位置插入一个 <br> 换行符，并利用“零宽空格”（ZWSP）解决光标无法在换行后正确显示的浏览器历史遗留 Bug
		if (isEffectivelyEmpty(element)) return 0;
		// 零宽空格仅用于光标定位，不计入字数
		const text = (element.textContent ?? '').replace(/\u200B/g, '');
		const brCount = (element.innerHTML.match(/<br\s*\/?>/gi) ?? []).length;
		return text.length + brCount;
	}

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const selection = window.getSelection();
		if (!selection) return;

		if (popoverOpen && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
			e.preventDefault();
			return;
		}

		if (
			e.key === '@' &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey &&
			contentEditableRef?.contains(target)
		) {
			e.preventDefault();
			openPopoverFromTypedAt(target);
			return;
		}

		if (e.key === 'Enter') {
			e.preventDefault();
			selection.deleteFromDocument();

			let range: Range;
			if (selection.rangeCount > 0) {
				range = selection.getRangeAt(0);
			} else {
				range = document.createRange();
				range.selectNodeContents(target);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
			}

			const fragment = document.createDocumentFragment();
			const zwsp = document.createTextNode(ZWSP);
			fragment.appendChild(document.createElement('br'));
			fragment.appendChild(zwsp);
			range.insertNode(fragment);
			range.setStartAfter(zwsp);
			range.collapse(true);
			selection.removeAllRanges();
			selection.addRange(range);

			target.dispatchEvent(new InputEvent('input', { bubbles: true }));
			return;
		}

		if (e.key === 'Backspace' && selection.isCollapsed) {
			const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
			if (!range || !target.contains(range.commonAncestorContainer)) return;

			const { startContainer, startOffset } = range;
			let zwspNode: Node | null = null;
			let br: Element | null = null;

			if (startOffset > 0 && startContainer.nodeType === Node.TEXT_NODE) {
				const charBefore = startContainer.textContent?.charAt(startOffset - 1) ?? '';
				if (charBefore === ZWSP) {
					zwspNode = startContainer;
					br = startContainer.previousSibling as Element | null;
				}
			} else if (startOffset === 0) {
				const prev = startContainer.previousSibling;
				if (prev?.nodeType === Node.TEXT_NODE) {
					const text = prev.textContent ?? '';
					if (text.charAt(text.length - 1) === ZWSP) {
						zwspNode = prev;
						br = prev.previousSibling as Element | null;
					}
				}
			}

			if (br?.nodeName === 'BR' && zwspNode) {
				e.preventDefault();
				range.setStartBefore(br);
				range.setEnd(
					zwspNode === startContainer ? startContainer : zwspNode,
					zwspNode === startContainer ? startOffset : (zwspNode.textContent ?? '').length
				);
				range.deleteContents();
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);

				target.dispatchEvent(new InputEvent('input', { bubbles: true }));
				requestAnimationFrame(() => {
					isEmpty = isEffectivelyEmpty(target);
					wordCount = getTextLengthWithNewlines(target);
					if (wordCount > maxLength) wordCount = maxLength;
				});
			}
		}
	}

	function handleRichTextareaInput(event: Event) {
		const target = event.target as HTMLDivElement;
		isEmpty = isEffectivelyEmpty(target);
		wordCount = getTextLengthWithNewlines(target);
		if (wordCount > maxLength) {
			wordCount = maxLength;
		}
		if (popoverOpen && contentEditableRef) {
			const textBefore = getTextBeforeCaret(target);
			const atIdx = textBefore.lastIndexOf('@');
			if (atIdx < 0) {
				handlePopoverClose();
			} else {
				searchQuery = textBefore.slice(atIdx + 1);
				filteredUserList = filterUsersByQuery(MOCK_USERS, searchQuery);
				selectedIndex = Math.min(selectedIndex, Math.max(0, filteredUserList.length - 1));
				const sel = window.getSelection();
				if (sel && sel.rangeCount > 0) {
					const range = sel.getRangeAt(0);
					if (target.contains(range.commonAncestorContainer)) {
						const rect = range.getBoundingClientRect();
						const rectValid = rect.width > 0 || rect.height > 0;
						if (rectValid) {
							popoverPosition = { left: rect.left, top: rect.bottom + 4 };
						}
					}
				}
			}
		}
	}

	function handlePaste(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		const target = (contentEditableRef ?? e.target) as HTMLElement;
		const selection = window.getSelection();
		if (!selection || !target) return;

		selection.deleteFromDocument();

		let range: Range;
		if (selection.rangeCount > 0) {
			const existingRange = selection.getRangeAt(0);
			// 确保 range 在 contenteditable 内
			if (target.contains(existingRange.commonAncestorContainer)) {
				range = existingRange;
			} else {
				range = document.createRange();
				range.selectNodeContents(target);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		} else {
			// 全选删除后 range 可能被清空，需手动创建（如仅剩 br 时）
			range = document.createRange();
			range.selectNodeContents(target);
			range.collapse(true);
			selection.removeAllRanges();
			selection.addRange(range);
		}

		// 多行文本：\n 转为 br + 零宽空格，与 Enter 行为一致
		const parts = text.split('\n');
		const fragment = document.createDocumentFragment();
		parts.forEach((part, i) => {
			fragment.appendChild(document.createTextNode(part));
			if (i < parts.length - 1) {
				fragment.appendChild(document.createElement('br'));
				fragment.appendChild(document.createTextNode(ZWSP));
			}
		});
		const lastInserted = fragment.lastChild ?? fragment.firstChild;
		range.insertNode(fragment);
		if (lastInserted) {
			range.setStartAfter(lastInserted);
			range.collapse(true);
		}
		selection.removeAllRanges();
		selection.addRange(range);

		// 延迟更新状态，确保 DOM 已更新（全选删除后粘贴时同步 dispatch 可能失效）
		requestAnimationFrame(() => {
			isEmpty = isEffectivelyEmpty(target);
			wordCount = getTextLengthWithNewlines(target);
			if (wordCount > maxLength) wordCount = maxLength;
		});
	}

	function handleContainerClick(e: MouseEvent) {
		/**
		 * 点击容器时，如果光标不在容器内，则将光标移到容器内
		 */
		const target = e.target as Node;
		if (!contentEditableRef?.contains(target)) {
			contentEditableRef?.focus();
			const sel = window.getSelection();
			if (sel && contentEditableRef) {
				const range = document.createRange();
				range.selectNodeContents(contentEditableRef);
				range.collapse(false);
				sel.removeAllRanges();
				sel.addRange(range);
			}
		}
	}
</script>

<div bind:this={editorContainerRef} class="relative">
	<div
		class={cn(
			'relative min-h-[80px] w-full cursor-text rounded-2xl border-0 bg-zinc-100 px-3 pt-2 pb-8 text-base caret-primary shadow-xs ring-offset-background transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900',
			className
		)}
		onclick={handleContainerClick}
		{...restProps}
	>
		<div
			class="pointer-events-none absolute top-2 left-3 text-muted-foreground {!isEmpty && 'hidden'}"
		>
			{placeholder}
		</div>
		<div
			contentEditable="true"
			role="textbox"
			tabindex="0"
			class="min-h-12 outline-none"
			bind:this={contentEditableRef}
			onkeydown={handleKeydown}
			oninput={handleRichTextareaInput}
			onpaste={handlePaste}
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
			onclick={handleAtButtonClick}
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
	onSelect={handlePopoverSelect}
	onClose={handlePopoverClose}
	onClickOutside={handlePopoverClose}
	ignoreClickRef={editorContainerRef}
/>
