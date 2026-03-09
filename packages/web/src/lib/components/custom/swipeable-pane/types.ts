/**
 * @file SwipeablePane 组件类型定义
 */

import type { Snippet } from 'svelte';

/** 分类选项（来自 API 或硬编码） */
export interface CategoryOption {
	/** 显示标签 */
	label: string;
	/** 分类 ID */
	value: string;
	/**
	 * 内容类型，决定渲染哪种组件
	 * - 'waterfall': 瀑布流（默认）
	 * - 'list': 无限滚动列表
	 */
	contentType?: 'waterfall' | 'list';
}

/** SwipeablePane 组件属性 */
export interface SwipeablePaneProps {
	/** 所有分类选项 */
	categories: CategoryOption[];
	/** 当前选中的分类索引 */
	currentIndex: number;
	/**
	 * 面板内容渲染函数（Svelte snippet）
	 * 接收分类信息和索引，渲染对应的内容组件
	 */
	children: Snippet<[CategoryOption, number]>;
	/**
	 * 手势意图确认回调（动画开始前触发）
	 * 在 swipe 方向判定 committed 后、Spring 动画开始前立即调用。
	 * 适用于需要提前知道目标索引的场景（如提前切换 Tab 高亮）。
	 *
	 * @param targetIndex - 目标分类索引
	 */
	onCommit?: (targetIndex: number) => void;
	/**
	 * 动画完成后的索引更新回调
	 * 在 Spring 动画播放结束、面板虚拟窗口切换后触发。
	 *
	 * @param newIndex - 新的分类索引
	 */
	onIndexChange?: (newIndex: number) => void;
}
