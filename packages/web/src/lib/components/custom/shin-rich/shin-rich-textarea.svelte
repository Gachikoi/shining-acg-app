<script lang="ts">
	import { cn } from '$lib/utils';

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

	const ZWSP = '\u200B'; // 零宽空格，用于光标落点

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
		if (isEffectivelyEmpty(element)) return 0;
		// 零宽空格仅用于光标定位，不计入字数
		const text = (element.textContent ?? '').replace(/\u200B/g, '');
		const brCount = (element.innerHTML.match(/<br\s*\/?>/gi) ?? []).length;
		return text.length + brCount;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();

		const target = e.target as HTMLElement;
		const selection = window.getSelection();
		if (!selection) return;

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
	}

	function handleRichTextareaInput(event: Event) {
		const target = event.target as HTMLDivElement;
		isEmpty = isEffectivelyEmpty(target);
		// TODO: 涉及到 @ 时需要做特殊处理，目前只统计普通文字字数
		wordCount = getTextLengthWithNewlines(target);
		if (wordCount > maxLength) {
			wordCount = maxLength;
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
</script>

<div
	class={cn(
		'relative min-h-[80px] w-full cursor-text rounded-2xl border-0 bg-zinc-100 px-3 pt-2 pb-8 text-base caret-primary shadow-xs ring-offset-background transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900',
		className
	)}
	onclick={() => contentEditableRef?.focus()}
	{...restProps}
>
	<div class="absolute top-2 left-3 text-muted-foreground {!isEmpty && 'hidden'}">
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
