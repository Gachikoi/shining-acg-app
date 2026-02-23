import type { KeydownHandler } from './types';

/** 输入 @ 时打开 popover */
export const atKeyHandler: KeydownHandler = {
	canHandle(e, ctx) {
		return (
			e.key === '@' &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey &&
			(ctx.deps.getContentEditableRef()?.contains(ctx.target) ?? false)
		);
	},
	handle(e, ctx) {
		e.preventDefault();
		ctx.openPopoverFromTypedAt(ctx.target);
		return true;
	}
};
