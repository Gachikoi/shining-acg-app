import type { KeydownHandler } from './types';

/** Popover 打开时，方向键、Enter、Escape 交由 popover 消费 */
export const popoverDelegationHandler: KeydownHandler = {
	canHandle(e, ctx) {
		return ctx.deps.getPopoverOpen() && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key);
	},
	handle(e) {
		e.preventDefault();
		return true;
	}
};
