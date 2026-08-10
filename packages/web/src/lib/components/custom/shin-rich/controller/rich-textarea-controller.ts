/**
 * RichTextareaController - 富文本输入框业务逻辑控制器
 *
 * 封装 ShinRichTextarea 的 contenteditable 交互逻辑，包括：
 * - 键盘：Enter 换行、Backspace 删除（含 mention、br+ZWSP 整行删除）
 * - 粘贴：多行文本 \n 转为 br+ZWSP
 * - @ 提及：按钮点击、输入 @ 触发，选择用户后插入 mention 节点
 *
 * 通过依赖注入（Deps）与 Svelte 组件解耦，避免直接依赖 $state/$props。
 *
 * 这块的边界处理真是有点恐怖了，一直在进行各种边界判断，但是暂无优化思路。
 */

import { tick } from 'svelte';
import type { MentionUser } from '../components/shin-rich-popover.svelte';
import {
	getRangeInTarget,
	getTextBeforeCaret,
	getTextBeforeCaretWithPositions,
	getTextLengthWithNewlines,
	insertAtEnd,
	insertTextAtCaret,
	isEffectivelyEmpty,
	NBSP,
	tryGetCaretPosition,
	ZWSP
} from '../utils/contenteditable';
import { createKeydownHandlerChain, type KeydownContext } from '../keydown-handlers';

/**
 * 控制器依赖注入接口
 * 所有与组件状态、DOM 的交互均通过此接口，便于测试与解耦
 */
export interface RichTextareaControllerDeps {
	/** 获取 contenteditable 根元素 */
	getContentEditableRef: () => HTMLDivElement | null;
	/** 获取 mention 模板容器（用于 cloneNode 生成 mention 元素） */
	getMentionTemplateRef: () => HTMLDivElement | null;
	/** 获取 @ 按钮元素（用于计算 popover 定位） */
	getAtButtonRef: () => HTMLSpanElement | null;
	/** 获取编辑器容器（用于点击外部关闭 popover 时排除） */
	getEditorContainerRef: () => HTMLDivElement | null;
	/** 获取 popover 是否打开 */
	getPopoverOpen: () => boolean;
	/** 获取当前选中用户索引 */
	getSelectedIndex: () => number;
	/** 获取 @ 后的搜索关键词 */
	getSearchQuery: () => string;
	/** 获取过滤后的用户列表 */
	getFilteredUserList: () => MentionUser[];
	/** 获取最大字数限制 */
	getMaxLength: () => number;
	/** 获取点击 mention 时的回调 */
	getOnMentionClick: () => ((userId: string) => void) | undefined;
	/** 设置模板当前渲染的用户（用于 Svelte 渲染 mention 后 clone） */
	setMentionTemplateUser: (user: MentionUser | null) => void;
	/** 设置内容是否为空 */
	setEmpty: (v: boolean) => void;
	/** 设置当前字数 */
	setWordCount: (v: number) => void;
	/** 设置 popover 开关 */
	setPopoverOpen: (v: boolean) => void;
	/** 设置 popover 定位坐标（屏幕坐标） */
	setPopoverPosition: (v: { left: number; top: number }) => void;
	/** 设置选中索引 */
	setSelectedIndex: (v: number) => void;
	/** 设置搜索关键词 */
	setSearchQuery: (v: string) => void;
}

export class RichTextareaController {
	private readonly keydownHandlers = createKeydownHandlerChain();

	constructor(private deps: RichTextareaControllerDeps) {}

	/** contenteditable 根元素快捷访问 */
	private get target() {
		return this.deps.getContentEditableRef();
	}

	/**
	 * 根据当前 DOM 内容更新 isEmpty、wordCount 状态
	 * 在 input、paste、backspace 等操作后调用
	 */
	private updateStats(target: HTMLElement) {
		this.deps.setEmpty(isEffectivelyEmpty(target));
		let wc = getTextLengthWithNewlines(target);
		if (wc > this.deps.getMaxLength()) wc = this.deps.getMaxLength();
		this.deps.setWordCount(wc);
	}

	/**
	 * 从 Svelte 渲染的模板 clone 出 mention 元素
	 * 流程：设置 mentionTemplateUser -> tick 等待渲染 -> 从模板 querySelector 并 clone -> 清空模板用户
	 * 若模板未就绪，则手动创建 span 作为 fallback
	 */
	private async cloneMentionFromTemplate(user: MentionUser): Promise<HTMLElement> {
		const templateRef = this.deps.getMentionTemplateRef();
		this.deps.setMentionTemplateUser(user);
		await tick();
		const template = templateRef?.querySelector<HTMLElement>('[data-mention-user-id]');
		this.deps.setMentionTemplateUser(null);
		if (template) {
			return template.cloneNode(true) as HTMLElement;
		}
		// Fallback：模板未渲染时手动创建
		const span = document.createElement('span');
		span.contentEditable = 'false';
		span.dataset.mentionUserId = user.id;
		span.className =
			'inline-block cursor-pointer text-blue-500 hover:underline hover:text-blue-600';
		span.textContent = `@${user.remark ?? user.name}`;
		return span;
	}

	/**
	 * 在光标处插入 mention 元素 + 尾随空格
	 * 插入后将光标移到空格之后
	 */
	private async insertMentionAtCaret(target: HTMLElement, user: MentionUser): Promise<void> {
		const mentionEl = await this.cloneMentionFromTemplate(user);
		const spaceNode = document.createTextNode(NBSP);
		const fragment = document.createDocumentFragment();
		fragment.appendChild(mentionEl);
		fragment.appendChild(spaceNode);

		const range = getRangeInTarget(target);
		if (!range) return;
		range.deleteContents();
		range.insertNode(fragment);
		range.setStartAfter(spaceNode);
		range.collapse(true);
		const sel = window.getSelection();
		if (sel) {
			sel.removeAllRanges();
			sel.addRange(range);
		}
	}

	/**
	 * 处理 @ 按钮点击
	 * - 有焦点：在光标处插入 @
	 * - 无焦点：聚焦后在末尾插入 @
	 * 然后以按钮位置打开 popover
	 */
	handleAtButtonClick(): void {
		const target = this.target;
		if (!target) return;
		const hasFocus = document.activeElement === target;
		if (hasFocus) {
			insertTextAtCaret(target, '@');
		} else {
			target.focus();
			insertAtEnd(target, '@');
		}
		const atButtonRef = this.deps.getAtButtonRef();
		if (atButtonRef) {
			const rect = atButtonRef.getBoundingClientRect();
			this.deps.setPopoverPosition({ left: rect.left, top: rect.bottom + 4 });
		}
		this.deps.setSelectedIndex(0);
		this.deps.setSearchQuery('');
		this.deps.setPopoverOpen(true);
		target.focus();
		target.dispatchEvent(new InputEvent('input', { bubbles: true }));
	}

	/**
	 * 处理 popover 中选择用户
	 * 找到光标前最后一个 @ 的位置，删除 @ 到光标之间的内容，插入 mention + 空格
	 * 若无法定位 @，则退化为在光标处插入
	 */
	async handlePopoverSelect(user: MentionUser): Promise<void> {
		const target = this.target;
		if (!target) return;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return;
		const range = sel.getRangeAt(0);
		if (!target.contains(range.commonAncestorContainer)) return;
		const caretResult = getTextBeforeCaretWithPositions(target);
		const atIdx = caretResult ? caretResult.text.lastIndexOf('@') : -1;
		if (atIdx >= 0 && caretResult) {
			const startPos = caretResult.getPositionAt(atIdx);
			if (startPos) {
				// 删除 @ 到光标之间的内容
				const deleteRange = document.createRange();
				deleteRange.setStart(startPos.node, startPos.offset);
				deleteRange.setEnd(range.startContainer, range.startOffset);
				deleteRange.deleteContents();
				// 在 @ 原位置插入 mention
				const insertRange = document.createRange();
				insertRange.setStart(startPos.node, startPos.offset);
				insertRange.collapse(true);
				const mentionEl = await this.cloneMentionFromTemplate(user);
				const spaceNode = document.createTextNode(NBSP);
				const fragment = document.createDocumentFragment();
				fragment.appendChild(mentionEl);
				fragment.appendChild(spaceNode);
				insertRange.insertNode(fragment);
				insertRange.setStartAfter(spaceNode);
				insertRange.collapse(true);
				sel.removeAllRanges();
				sel.addRange(insertRange);
			} else {
				await this.insertMentionAtCaret(target, user);
			}
		} else {
			await this.insertMentionAtCaret(target, user);
		}
		this.deps.setPopoverOpen(false);
		this.deps.setSelectedIndex(0);
		target.dispatchEvent(new InputEvent('input', { bubbles: true }));
	}

	/** 关闭 popover，重置选中索引与搜索关键词 */
	handlePopoverClose(): void {
		this.deps.setPopoverOpen(false);
		this.deps.setSelectedIndex(0);
		this.deps.setSearchQuery('');
	}

	/**
	 * 用户输入 @ 时打开 popover
	 * 在光标处插入 @，等待 DOM 更新后计算光标位置，打开 popover
	 */
	async openPopoverFromTypedAt(target: HTMLElement): Promise<void> {
		insertTextAtCaret(target, '@');
		target.dispatchEvent(new InputEvent('input', { bubbles: true }));
		this.deps.setSelectedIndex(0);
		this.deps.setSearchQuery('');

		// 等待布局稳定后获取光标位置
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		let pos = tryGetCaretPosition(target);
		if (!pos) {
			await new Promise<void>((r) => requestAnimationFrame(() => r()));
			pos = tryGetCaretPosition(target);
		}
		if (pos) {
			this.deps.setPopoverPosition(pos);
		} else {
			const targetRect = target.getBoundingClientRect();
			this.deps.setPopoverPosition({
				left: targetRect.left,
				top: targetRect.bottom + 4
			});
		}
		await tick();
		this.deps.setPopoverOpen(true);
		target.focus();
	}

	/**
	 * 处理键盘按下（责任链模式）
	 * - ArrowUp/Down/Enter/Escape：popover 打开时由 popover 消费
	 * - @：在 contenteditable 内输入 @ 时打开 popover
	 * - Enter：插入 br+ZWSP 换行
	 * - Backspace：mention 删除、br+ZWSP 整行删除、@ 删除时关闭 popover
	 */
	handleKeydown(e: KeyboardEvent): void {
		const target = e.target as HTMLElement;
		const selection = window.getSelection();
		if (!selection) return;

		const ctx: KeydownContext = {
			target,
			selection,
			deps: this.deps,
			updateStats: (t) => this.updateStats(t),
			openPopoverFromTypedAt: (t) => this.openPopoverFromTypedAt(t),
			handlePopoverClose: () => this.handlePopoverClose()
		};

		for (const handler of this.keydownHandlers) {
			if (handler.canHandle(e, ctx) && handler.handle(e, ctx)) {
				return;
			}
		}
	}

	/**
	 * 处理 contenteditable 的 input 事件
	 * 更新 isEmpty、wordCount；若 popover 打开则更新 searchQuery、selectedIndex、popoverPosition
	 */
	handleRichTextareaInput(event: Event): void {
		const target = event.target as HTMLDivElement;
		this.updateStats(target);

		if (this.deps.getPopoverOpen() && this.target) {
			// 仅识别用户输入的 @，不包含 mention 内的 @
			const textBefore = getTextBeforeCaret(target, {
				skipMentionContent: true
			});
			const atIdx = textBefore.lastIndexOf('@');
			if (atIdx < 0) {
				this.handlePopoverClose();
			} else {
				this.deps.setSearchQuery(textBefore.slice(atIdx + 1));
				const filtered = this.deps.getFilteredUserList();
				this.deps.setSelectedIndex(
					Math.min(this.deps.getSelectedIndex(), Math.max(0, filtered.length - 1))
				);
				const sel = window.getSelection();
				if (sel && sel.rangeCount > 0) {
					const range = sel.getRangeAt(0);
					if (target.contains(range.commonAncestorContainer)) {
						const rect = range.getBoundingClientRect();
						if (rect.width > 0 || rect.height > 0) {
							this.deps.setPopoverPosition({
								left: rect.left,
								top: rect.bottom + 4
							});
						}
					}
				}
			}
		}
	}

	/**
	 * 处理粘贴
	 * 纯文本：\n 转为 br+ZWSP，与 Enter 行为一致
	 */
	handlePaste(e: ClipboardEvent): void {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		const target = (this.target ?? e.target) as HTMLElement;
		if (!target) return;

		const selection = window.getSelection();
		selection?.deleteFromDocument();

		const range = getRangeInTarget(target);
		if (!range) return;

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
		const sel = window.getSelection();
		if (sel) {
			sel.removeAllRanges();
			sel.addRange(range);
		}

		requestAnimationFrame(() => this.updateStats(target));
	}

	/**
	 * 处理编辑器容器点击
	 * - 点击 mention：阻止默认，若注入 onMentionClick 则调用
	 * - 点击容器非 contenteditable 区域：将光标移到 contenteditable 末尾并聚焦
	 */
	handleContainerClick(e: MouseEvent): void {
		const target = e.target as Node;
		const mentionEl = (target as Element).closest?.('[data-mention-user-id]');
		if (mentionEl) {
			e.preventDefault();
			e.stopPropagation();
			const userId = mentionEl.getAttribute('data-mention-user-id');
			if (userId) this.deps.getOnMentionClick?.()?.(userId);
			return;
		}
		const contentEditableRef = this.target;
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
}
