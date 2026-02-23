import type { KeydownHandler } from './types';
import { popoverDelegationHandler } from './popover-delegation';
import { atKeyHandler } from './at-key';
import { enterKeyHandler } from './enter-key';
import { backspaceHandler } from './backspace-handler';

export type { KeydownContext, KeydownHandler } from './types';

/** 创建按优先级排序的 Keydown 责任链 */
export function createKeydownHandlerChain(): KeydownHandler[] {
	return [popoverDelegationHandler, atKeyHandler, enterKeyHandler, backspaceHandler];
}
