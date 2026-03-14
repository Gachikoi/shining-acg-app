import type { TextCoverRenderer, TextCoverStyleId } from './types';

/** 文字封面样式注册表，按 id 查找渲染器。新增样式时 register，禁止覆盖已有 id。 */
const textCoverRegistry = new Map<TextCoverStyleId, TextCoverRenderer>();

export function registerTextCoverRenderer(renderer: TextCoverRenderer): void {
	if (textCoverRegistry.has(renderer.id)) {
		throw new Error(`TextCoverRenderer id "${renderer.id}" already registered`);
	}
	textCoverRegistry.set(renderer.id, renderer);
}

export function getTextCoverRenderer(id: TextCoverStyleId): TextCoverRenderer | undefined {
	return textCoverRegistry.get(id);
}

export function listTextCoverStyleIds(): TextCoverStyleId[] {
	return Array.from(textCoverRegistry.keys());
}

/** 白名单：仅已注册样式 ID 视为合法，避免运行时异常。 */
export function isTextCoverStyleId(id: string): boolean {
	return typeof id === 'string' && id.length > 0 && textCoverRegistry.has(id);
}
