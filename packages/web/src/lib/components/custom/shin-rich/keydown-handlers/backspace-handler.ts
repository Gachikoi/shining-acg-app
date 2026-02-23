import { ZWSP } from '../contenteditable-utils';
import type { KeydownContext, KeydownHandler } from './types';

/** Backspace 内部责任链的上下文 */
interface BackspaceContext {
	target: HTMLElement;
	selection: Selection;
	range: Range;
	startContainer: Node;
	startOffset: number;
	nodeBeforeCursor: Node | null;
	deps: KeydownContext['deps'];
	updateStats: (target: HTMLElement) => void;
	handlePopoverClose: () => void;
}

function getNodeBeforeCursor(range: Range): Node | null {
	const { startContainer, startOffset } = range;
	if (startOffset > 0) {
		if (startContainer.nodeType === Node.TEXT_NODE) {
			return null; // 在文本节点内，退格删除字符，不在此处理 mention
		}
		return startContainer.childNodes[startOffset - 1];
	}
	return startContainer.previousSibling;
}

/** 1b. 光标前为仅空格的文本且其前为 mention：一次退格同时删除空格和 mention */
function deleteSpaceAndMentionBeforeCursor(ctx: BackspaceContext): boolean {
	const { nodeBeforeCursor } = ctx;
	if (nodeBeforeCursor?.nodeType !== Node.TEXT_NODE) return false;

	const text = (nodeBeforeCursor.textContent ?? '').replace(/\u200B/g, '');
	if (!/^\s*$/.test(text) || text.length === 0) return false;

	const prev = nodeBeforeCursor.previousSibling;
	if (
		prev?.nodeType !== Node.ELEMENT_NODE ||
		!(prev as Element).hasAttribute?.('data-mention-user-id')
	) {
		return false;
	}

	const mentionEl = prev as Element;
	ctx.range.setStartBefore(mentionEl);
	ctx.range.setEndAfter(nodeBeforeCursor);
	ctx.range.deleteContents();
	ctx.range.collapse(true);
	ctx.selection.removeAllRanges();
	ctx.selection.addRange(ctx.range);
	ctx.target.dispatchEvent(new InputEvent('input', { bubbles: true }));
	requestAnimationFrame(() => ctx.updateStats(ctx.target));
	return true;
}

/** 1. 光标前为 mention：删除该 mention */
function deleteMentionBeforeCursor(ctx: BackspaceContext): boolean {
	const mentionEl: Element | null =
		ctx.nodeBeforeCursor?.nodeType === Node.ELEMENT_NODE &&
		(ctx.nodeBeforeCursor as Element).hasAttribute?.('data-mention-user-id')
			? (ctx.nodeBeforeCursor as Element)
			: null;

	if (!mentionEl) return false;

	ctx.range.setStartBefore(mentionEl);
	ctx.range.setEndAfter(mentionEl);
	ctx.range.deleteContents();
	ctx.range.collapse(true);
	ctx.selection.removeAllRanges();
	ctx.selection.addRange(ctx.range);
	ctx.target.dispatchEvent(new InputEvent('input', { bubbles: true }));
	requestAnimationFrame(() => ctx.updateStats(ctx.target));
	return true;
}

/** 2. 光标在 br+ZWSP 之后：一次退格删除整行换行 */
function deleteBrZwspLine(ctx: BackspaceContext): boolean {
	const { startContainer, startOffset, nodeBeforeCursor } = ctx;
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
	} else if (nodeBeforeCursor?.nodeType === Node.TEXT_NODE) {
		const text = nodeBeforeCursor.textContent ?? '';
		if (text.replace(/\u200B/g, '') === '' && text.length > 0) {
			zwspNode = nodeBeforeCursor;
			br = nodeBeforeCursor.previousSibling as Element | null;
		}
	}

	if (br?.nodeName !== 'BR' || !zwspNode) return false;

	ctx.range.setStartBefore(br);
	ctx.range.setEnd(
		zwspNode === startContainer ? startContainer : zwspNode,
		zwspNode === startContainer ? startOffset : (zwspNode.textContent ?? '').length
	);
	ctx.range.deleteContents();
	ctx.range.collapse(true);
	ctx.selection.removeAllRanges();
	ctx.selection.addRange(ctx.range);

	ctx.target.dispatchEvent(new InputEvent('input', { bubbles: true }));
	requestAnimationFrame(() => ctx.updateStats(ctx.target));
	return true;
}

/** 3. 即将删除纯文本 @ 时关闭 popover（不 preventDefault） */
function closePopoverWhenDeletingAt(ctx: BackspaceContext): boolean {
	if (!ctx.deps.getPopoverOpen() || ctx.nodeBeforeCursor?.nodeType !== Node.TEXT_NODE) {
		return false;
	}
	const text = (ctx.nodeBeforeCursor.textContent ?? '').replace(/\u200B/g, '');
	const isPlainAt =
		text === '@' ||
		(text.length > 0 && text.charAt(text.length - 1) === '@' && ctx.startOffset === 0);
	if (isPlainAt && !ctx.nodeBeforeCursor.parentElement?.closest?.('[data-mention-user-id]')) {
		ctx.handlePopoverClose();
	}
	return false; // 不消费事件，让浏览器执行默认退格
}

/** 4. 兜底：用 LeftArrow + Delete 等效逻辑替代默认 Backspace（mention 等场景下更稳定） */
function fallbackLeftArrowDelete(ctx: BackspaceContext): boolean {
	const { range, selection, target, updateStats } = ctx;
	const rangeBefore = range.cloneRange();
	selection.modify('move', 'left', 'character');
	const currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
	const moved =
		currentRange &&
		(currentRange.startContainer !== rangeBefore.startContainer ||
			currentRange.startOffset !== rangeBefore.startOffset);
	if (!moved) {
		selection.removeAllRanges();
		selection.addRange(rangeBefore);
		return false;
	}
	selection.modify('extend', 'right', 'character');
	selection.deleteFromDocument();
	target.dispatchEvent(new InputEvent('input', { bubbles: true }));
	requestAnimationFrame(() => updateStats(target));
	return true;
}

const backspaceCases: ((ctx: BackspaceContext) => boolean)[] = [
	deleteSpaceAndMentionBeforeCursor,
	deleteMentionBeforeCursor,
	deleteBrZwspLine,
	closePopoverWhenDeletingAt,
	fallbackLeftArrowDelete
];

/** Backspace：处理 mention 删除、br+ZWSP 整行删除、@ 删除时关闭 popover */
export const backspaceHandler: KeydownHandler = {
	canHandle(e, ctx) {
		return e.key === 'Backspace' && ctx.selection.isCollapsed;
	},
	handle(e, ctx) {
		const range = ctx.selection.rangeCount > 0 ? ctx.selection.getRangeAt(0) : null;
		if (!range || !ctx.target.contains(range.commonAncestorContainer)) return false;

		const nodeBeforeCursor = getNodeBeforeCursor(range);
		const backspaceCtx: BackspaceContext = {
			target: ctx.target,
			selection: ctx.selection,
			range,
			startContainer: range.startContainer,
			startOffset: range.startOffset,
			nodeBeforeCursor,
			deps: ctx.deps,
			updateStats: ctx.updateStats,
			handlePopoverClose: ctx.handlePopoverClose
		};

		for (const caseFn of backspaceCases) {
			const handled = caseFn(backspaceCtx);
			if (handled) {
				e.preventDefault();
				return true;
			}
		}
		return false;
	}
};
