import type { RichTextareaControllerDeps } from '../rich-textarea-controller';

/**
 * Keydown 处理器上下文
 * 各 Handler 通过此接口获取所需能力，不直接依赖 RichTextareaController
 */
export interface KeydownContext {
	target: HTMLElement;
	selection: Selection;
	deps: RichTextareaControllerDeps;
	updateStats: (target: HTMLElement) => void;
	openPopoverFromTypedAt: (target: HTMLElement) => Promise<void>;
	handlePopoverClose: () => void;
}

/**
 * Keydown 处理器接口（责任链节点）
 */
export interface KeydownHandler {
	/** 是否愿意处理此事件（不执行副作用） */
	canHandle(e: KeyboardEvent, ctx: KeydownContext): boolean;
	/** 执行处理，返回 true 表示已消费事件（链终止） */
	handle(e: KeyboardEvent, ctx: KeydownContext): boolean;
}
