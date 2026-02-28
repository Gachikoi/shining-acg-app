/**
 * contenteditable 相关纯 DOM 工具函数
 * 用于 ShinRichTextarea 的选区、文本、换行等操作
 */

import type { V1PostContentUnit } from '$lib/api/types.gen';

/** 零宽空格，用于光标落点，解决跨浏览器换行后光标显示问题 */
export const ZWSP = '\u200B';

/** 非断行空格，用于插入 mention 后的空格 */
export const NBSP = '\u00A0';

/** 获取或创建在 target 内的有效选区 range */
export function getRangeInTarget(target: HTMLElement): Range | null {
	const sel = window.getSelection();
	if (!sel) return null;
	if (sel.rangeCount > 0) {
		const range = sel.getRangeAt(0);
		if (target.contains(range.commonAncestorContainer)) return range;
	}
	const range = document.createRange();
	range.selectNodeContents(target);
	range.collapse(false);
	sel.removeAllRanges();
	sel.addRange(range);
	return range;
}

/** 在光标处插入文本 */
export function insertTextAtCaret(target: HTMLElement, text: string): void {
	const range = getRangeInTarget(target);
	if (!range) return;
	range.deleteContents();
	range.insertNode(document.createTextNode(text));
	range.collapse(false);
	const sel = window.getSelection();
	if (sel) {
		sel.removeAllRanges();
		sel.addRange(range);
	}
}

/** 在末尾插入文本 */
export function insertAtEnd(target: HTMLElement, text: string): void {
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

/**
 * 将 contenteditable 内容转为与 getTextBeforeCaret 一致的字符序列（br 视为 \n）
 * 返回 charIndex 对应的 DOM 位置
 */
export function getNodeOffsetAtCharIndex(
	root: HTMLElement,
	charIndex: number
): { node: Node; offset: number } | null {
	const walker = document.createTreeWalker(
		root,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		null
	);
	let count = 0;
	let node: Node | null = walker.nextNode();
	while (node) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = (node.textContent ?? '').replace(/\u200B/g, '');
			const len = text.length;
			if (count + len >= charIndex) {
				return { node, offset: charIndex - count };
			}
			count += len;
		} else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
			count += 1;
		}
		node = walker.nextNode();
	}
	return null;
}

/**
 * 一次遍历得到光标前文本 + 各 charIndex 的 DOM 位置，保证一致
 * @param skipMentionContent 为 true 时跳过 mention 内的文本
 */
export function getTextBeforeCaretWithPositions(
	target: HTMLElement,
	opts?: { skipMentionContent?: boolean }
): {
	text: string;
	getPositionAt: (charIndex: number) => { node: Node; offset: number } | null;
} | null {
	const skipMention = opts?.skipMentionContent ?? false;
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return null;
	const range = sel.getRangeAt(0);
	if (!target.contains(range.commonAncestorContainer)) return null;
	const endContainer = range.startContainer;
	const endOffset = range.startOffset;
	let result = '';
	const positions: { node: Node; offset: number }[] = [];
	const walker = document.createTreeWalker(
		target,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		null
	);
	let node: Node | null = walker.nextNode();
	while (node) {
		if (node === endContainer) {
			if (node.nodeType === Node.TEXT_NODE) {
				if (skipMention && node.parentElement?.closest?.('[data-mention-user-id]')) {
					break;
				}
				const text = (node.textContent ?? '').replace(/\u200B/g, '');
				const slice = text.slice(0, Math.min(endOffset, text.length));
				for (let i = 0; i < slice.length; i++) {
					positions[result.length + i] = { node, offset: i };
				}
				result += slice;
			}
			break;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			if (skipMention && node.parentElement?.closest?.('[data-mention-user-id]')) {
				node = walker.nextNode();
				continue;
			}
			const text = (node.textContent ?? '').replace(/\u200B/g, '');
			for (let i = 0; i < text.length; i++) {
				positions[result.length + i] = { node, offset: i };
			}
			result += text;
		} else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
			if (!skipMention || !(node as Element).closest?.('[data-mention-user-id]')) {
				const r = document.createRange();
				r.setStartBefore(node);
				r.collapse(true);
				positions[result.length] = { node: r.startContainer, offset: r.startOffset };
				result += '\n';
			}
		}
		node = walker.nextNode();
	}
	return {
		text: result,
		getPositionAt: (charIndex: number) =>
			charIndex >= 0 && charIndex < positions.length ? (positions[charIndex] ?? null) : null
	};
}

/**
 * 获取光标前的文本，与 DOM 结构一致：<br> 视为 \n，ZWSP 不计入
 * @param skipMentionContent 为 true 时跳过 mention 内的文本
 */
export function getTextBeforeCaret(
	target: HTMLElement,
	opts?: { skipMentionContent?: boolean }
): string {
	const r = getTextBeforeCaretWithPositions(target, opts);
	return r?.text ?? '';
}

/** 移除所有 <br> 和零宽空格后若为空，则视为空 */
export function isEffectivelyEmpty(element: HTMLElement): boolean {
	const html = element.innerHTML
		.replace(/<br\s*\/?>/gi, '')
		.replace(/\u200B/g, '')
		.trim()
		.toLowerCase();
	if (html === '') return true;
	const text = (element.textContent ?? '').replace(/\u200B/g, '').trim();
	return text === '';
}

/** 字数：文本长度 + <br> 数量，ZWSP 不计入 */
export function getTextLengthWithNewlines(element: HTMLElement): number {
	if (isEffectivelyEmpty(element)) return 0;
	const text = (element.textContent ?? '').replace(/\u200B/g, '');
	const brCount = (element.innerHTML.match(/<br\s*\/?>/gi) ?? []).length;
	return text.length + brCount;
}

/** 尝试获取光标位置的屏幕坐标 */
export function tryGetCaretPosition(target: HTMLElement): { left: number; top: number } | null {
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

export function extractContentFromShinRichTextarea(
	contenteditable: HTMLElement
): Array<V1PostContentUnit> {
	const result: Array<V1PostContentUnit> = [];

	function appendToLastTextOrPush(str: string) {
		if (str.length === 0) return;
		if (result.length > 0) {
			const last = result[result.length - 1];
			if (last.type === 'text') {
				last.content += str;
				return;
			}
		}
		result.push({ type: 'text', content: str });
	}

	for (const child of contenteditable.childNodes) {
		if (child.nodeType === Node.TEXT_NODE && child.textContent) {
			const text = child.textContent.replaceAll(ZWSP, '');
			appendToLastTextOrPush(text);
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			const element = child as Element;
			if (element.tagName === 'BR') {
				appendToLastTextOrPush('\n');
			} else if (element.hasAttribute('data-mention-user-id')) {
				const userId = element.getAttribute('data-mention-user-id');
				const name = element.textContent.slice(1); // @name

				if (!userId) {
					throw new Error('mention user id 不知为何丢失了');
				}
				result.push({
					type: 'mention',
					user_id: userId,
					name: name
				});
			}
		}
	}
	return result;
}
