/**
 * @file 手势系统公共工具函数
 * @description
 * 多手势共用的工具：ID 生成、wheel 事件标准化等。
 * 各手势专属工具见对应子目录：swipe/utils、feed-stream/。
 */

// ─── Wheel 事件标准化 ────────────────────────────────────────────

/**
 * 标准化 wheel 事件的 delta 值为像素
 *
 * 不同浏览器和输入设备的 deltaMode 不同：
 * - 0 (DOM_DELTA_PIXEL)：已经是像素
 * - 1 (DOM_DELTA_LINE)：按行计，乘以典型行高 40px
 * - 2 (DOM_DELTA_PAGE)：按页计，乘以典型页高 800px
 *
 * @param event - WheelEvent
 * @returns 标准化后的 { deltaX, deltaY }（均为像素）
 */
export function normalizeWheelDelta(event: WheelEvent): { deltaX: number; deltaY: number } {
	const { deltaX, deltaY } = event;
	if (event.deltaMode === 1) {
		return { deltaX: deltaX * 40, deltaY: deltaY * 40 };
	}
	if (event.deltaMode === 2) {
		return { deltaX: deltaX * 800, deltaY: deltaY * 800 };
	}
	return { deltaX, deltaY };
}

// ─── ID 生成 ─────────────────────────────────────────────────────

/** 自增计数器，用于生成竞技场内唯一的识别器 ID */
let idCounter = 0;

/**
 * 生成唯一识别器 ID
 *
 * @param prefix - ID 前缀（如 'swipe'、'feed-stream'）
 * @returns 格式为 `${prefix}-${counter}` 的唯一字符串
 */
export function generateId(prefix: string): string {
	return `${prefix}-${++idCounter}`;
}
