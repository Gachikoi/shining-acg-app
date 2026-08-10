import { getRangeInTarget, ZWSP } from '../utils/contenteditable';
import type { KeydownHandler } from './types';

/** Enter：插入 br+ZWSP 换行 */
export const enterKeyHandler: KeydownHandler = {
	canHandle(e) {
		return e.key === 'Enter';
	},
	handle(e, ctx) {
		e.preventDefault();
		ctx.selection.deleteFromDocument();

		const range = getRangeInTarget(ctx.target);
		if (!range) return false;

		const fragment = document.createDocumentFragment();
		const zwsp = document.createTextNode(ZWSP);
		fragment.appendChild(document.createElement('br'));
		fragment.appendChild(zwsp);
		range.insertNode(fragment);
		range.setStartAfter(zwsp);
		range.collapse(true);
		ctx.selection.removeAllRanges();
		ctx.selection.addRange(range);

		ctx.target.dispatchEvent(new InputEvent('input', { bubbles: true }));
		return true;
	}
};
