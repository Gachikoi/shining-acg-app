/**
 * contenteditable 相关纯 DOM 工具函数
 * 用于 ShinRichTextarea 的选区、文本、换行等操作
 */

/** 零宽空格，用于光标落点，解决跨浏览器换行后光标显示问题 */
export const ZWSP = '\u200B';

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
 * 获取光标前的文本，与 DOM 结构一致：<br> 视为 \n，ZWSP 不计入
 * @param skipMentionContent 为 true 时跳过 mention 内的文本
 */
export function getTextBeforeCaret(
	target: HTMLElement,
	opts?: { skipMentionContent?: boolean }
): string {
	const skipMention = opts?.skipMentionContent ?? false;
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return '';
	const range = sel.getRangeAt(0);
	if (!target.contains(range.commonAncestorContainer)) return '';
	const endContainer = range.startContainer;
	const endOffset = range.startOffset;
	let result = '';
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
				result += text.slice(0, Math.min(endOffset, text.length));
			}
			break;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			if (skipMention && node.parentElement?.closest?.('[data-mention-user-id]')) {
				node = walker.nextNode();
				continue;
			}
			result += (node.textContent ?? '').replace(/\u200B/g, '');
		} else if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR') {
			if (!skipMention || !(node as Element).closest?.('[data-mention-user-id]')) {
				result += '\n';
			}
		}
		node = walker.nextNode();
	}
	return result;
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
