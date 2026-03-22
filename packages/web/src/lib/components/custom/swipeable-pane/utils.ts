/**
 * @file SwipeablePane 纯函数工具
 * @description
 * 只保留两类纯逻辑：
 * 1. 基于窗口中心、当前 offset 和可选目标页生成最终渲染用的三槽 panels
 * 2. 基于当前 panels 读取视觉状态
 */
import type { CategoryOption } from './types';

export type PanelSlot = { category: CategoryOption; originalIndex: number } | null;

export type PanelTuple = [PanelSlot, PanelSlot, PanelSlot];

export type VisualState = {
	primaryIndex: number;
	secondaryIndex: number;
	residualOffset: number;
};

/**
 * 创建指定真实索引对应的槽位数据。
 *
 * @param index - 分类真实索引
 * @param categories - 全部分类列表
 * @returns 对应槽位的数据；越界时返回 null
 */
function createPanelSlot(index: number, categories: CategoryOption[]): PanelSlot {
	if (index < 0 || index >= categories.length) return null;
	return {
		category: categories[index],
		originalIndex: index
	};
}

/**
 * 生成当前真正需要渲染的三槽 panels。
 *
 * 规则：
 * - 默认以 `centerIndex` 构建 `[prev, current, next]`
 * - 存在跨页 jump 目标时，只把目标页借位到将进入视口的一侧
 * - 最终只保留当前视口相关槽位，以及当前 transition 的目标页
 *
 * @param centerIndex - 当前 slot 1 对应的真实索引
 * @param categories - 全部分类列表
 * @param offset - 以 slot 1 为基准的容器偏移量
 * @param width - 容器宽度
 * @param activeTargetIndex - 当前 transition 的目标索引，当有不基于位移的跳转时使用，传入目标 index
 * @returns 当前真正需要挂载到 DOM 的三槽窗口
 */
export function buildPanels(
	centerIndex: number,
	categories: CategoryOption[],
	offset: number,
	width: number,
	activeTargetIndex?: number
): PanelTuple {
	const panels: PanelTuple = [
		createPanelSlot(centerIndex - 1, categories),
		createPanelSlot(centerIndex, categories),
		createPanelSlot(centerIndex + 1, categories)
	];

	if (activeTargetIndex !== undefined && activeTargetIndex !== centerIndex) {
		const targetPanel = createPanelSlot(activeTargetIndex, categories);
		if (activeTargetIndex > centerIndex) {
			panels[2] = targetPanel;
		} else {
			panels[0] = targetPanel;
		}
	}

	return panels.map((panel, slot) => {
		if (!panel) return null;

		const left = (slot - 1) * width + offset;
		const isVisible = left < width && left + width > 0;
		const isActiveTarget = activeTargetIndex !== null && panel.originalIndex === activeTargetIndex;

		return isVisible || isActiveTarget ? panel : null;
	}) as PanelTuple;
}

/**
 * 读取当前三槽窗口在给定 offset 下的视觉状态。只能处理因为位移变化导致视觉中心变化的情况。
 *
 * @param offset - 以 slot 1 为基准的容器偏移量
 * @param panels - 当前三槽窗口
 * @param width - 容器宽度
 * @param fallbackIndex - 没有可用 panel 时回退的索引
 * @returns 最近/次近 panel 以及将最近 panel 对齐到 slot 1 所需的 residualOffset
 */
export function inspectVisualState(
	offset: number,
	panels: PanelTuple,
	width: number,
	fallbackIndex: number
): VisualState {
	let primaryIndex = fallbackIndex;
	let secondaryIndex = fallbackIndex;
	let primarySlot = 1;
	let minDistance = Infinity;
	let minSecondaryDistance = Infinity;

	for (let slot = 0; slot < panels.length; slot++) {
		const panel = panels[slot];
		if (!panel) continue;

		const panelTranslateX = (slot - 1) * width + offset;
		const distanceToCenter = Math.abs(panelTranslateX);

		if (distanceToCenter < minDistance) {
			if (minDistance < Infinity && minDistance < minSecondaryDistance) {
				minSecondaryDistance = minDistance;
				secondaryIndex = primaryIndex;
			}
			minDistance = distanceToCenter;
			primaryIndex = panel.originalIndex;
			primarySlot = slot;
		} else if (distanceToCenter < minSecondaryDistance) {
			minSecondaryDistance = distanceToCenter;
			secondaryIndex = panel.originalIndex;
		}
	}

	return {
		primaryIndex,
		secondaryIndex,
		residualOffset: (primarySlot - 1) * width + offset
	};
}
