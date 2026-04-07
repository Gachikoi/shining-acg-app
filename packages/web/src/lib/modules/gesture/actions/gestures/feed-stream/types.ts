/**
 * @file `use:feedStream` 类型定义
 * @description
 * 手势层只上报位移与阶段，不持有 Spring、不 await 业务刷新。
 */

import type { GestureSource } from '../../../core/types';

// ─── 下拉事件 Payload ────────────────────────────────────────────

/** pointer / wheel 跟手阶段，可能高频 */
export interface FeedPullMovePayload {
	/** 弹性映射后的位移（px） */
	elasticPx: number;
	/** 原始向下拖动量（px），自 pointerdown 起算 */
	rawDy: number;
	source: 'pointer' | 'wheel';
}

/** 单次下拉会话结束 */
export interface FeedPullEndPayload {
	/** 是否达到触发阈值（pointer：elasticPx ≥ triggerThreshold；wheel：累计物理量 ≥ wheelPullPhysicalCommit） */
	committed: boolean;
	/** 结束时的弹性位移（px） */
	elasticPx: number;
	source: 'pointer' | 'wheel';
}

/** 滚动 RAF 内单次回调（含 `scrollTop`） */
export interface FeedScrollFramePayload {
	scrollTop: number;
}

/** 能力开关：未指定时视为启用 */
export interface FeedStreamFeatures {
	/** 是否启用下拉识别与回调；false 时不注册 pointer/wheel 下拉 */
	pull?: boolean;
	/** 是否启用触底 `onLoadMore`；false 时 scroll 仅触发 `onScrollFrame` */
	loadMore?: boolean;
}

/**
 * 滚轮下拉通道状态机（`feedStream` 内部）
 *
 * - `idle`：未在滚轮下拉会话
 * - `pulling`：已占用 arena，反向 wheel 累计为下拉
 * - `scrolling`：本段手势按普通纵向滚动处理（未进入或未保持 pull）
 */
export type WheelPullPhase = 'idle' | 'pulling' | 'scrolling';

// ─── Options ─────────────────────────────────────────────────────

/**
 * `use:feedStream` 配置
 *
 * @property config - Feed 流手势参数（弹性、滚轮下拉提交量、触底距离等），未填字段使用 `DEFAULT_FEED_STREAM_CONFIG`
 * @property features - 下拉 / 触底能力开关
 * @property onPullMove - 跟手
 * @property onPullEnd - 结束
 * @property onPullActiveChange - 进入/退出下拉会话（arena 占用）
 * @property onScrollFrame - RAF 节流，用于虚拟列表与统一读 `scrollTop`
 * @property getContentHeight - 可滚动内容总高；虚拟列表必传
 * @property hasMore / loading - 触底判定
 * @property onLoadMore - 触底回调
 * @property disabled - 按事件来源动态禁用：返回 `true` 时该通道不发起/不恢复下拉（与 `use:swipe` 的 `disabled` 类似，但区分 pointer / wheel）
 */
export interface FeedStreamGestureOptions {
	/** 与默认配置浅合并；可只覆盖个别字段 */
	config?: Partial<FeedStreamConfig>;
	features?: FeedStreamFeatures;
	/**
	 * 按来源禁用 pointer 或 wheel 通道的下拉识别。
	 *
	 * @param source - `'pointer'`：触摸/鼠标指针；`'wheel'`：滚轮
	 * @returns `true` 时忽略该来源（pointer 在 pointerdown 与自动恢复路径上生效；wheel 在每次 `wheel` 事件入口生效）
	 */
	disabled?: (source: GestureSource) => boolean;
	onPullMove?: (payload: FeedPullMovePayload) => void;
	onPullEnd?: (payload: FeedPullEndPayload) => void | Promise<void>;
	onPullActiveChange?: (active: boolean) => void;
	onScrollFrame?: (payload: FeedScrollFramePayload) => void;
	getContentHeight?: () => number;
	hasMore?: () => boolean;
	loading?: () => boolean;
	onLoadMore?: () => void | Promise<void>;
}

/**
 * `use:feedStream` 完整配置（弹性映射、pointer/wheel 触发、触底）
 *
 * @property maxDistance - 最大下拉视觉距离（px）
 * @property triggerThreshold - pointer 释放刷新的弹性位移阈值（px）
 * @property triggeredDistance - 触发后保持的指示器位移（px）
 * @property elasticCoefficient - iOS Rubber Banding 弹性系数 c
 * @property elasticDimensionMultiplier - 弹性饱和上限倍数：d = maxDistance × 此值
 * @property wheelPullPhysicalCommit - 滚轮下拉通道：累计原始物理拖动量（px，与 `mapElasticDistance` 输入同量纲）达到此值则 `onPullEnd.committed === true`
 * @property loadingThreshold - 距可滚动内容底部多少 px 触发 `onLoadMore`（与下拉阈值无关）
 */
export interface FeedStreamConfig {
	maxDistance: number;
	triggerThreshold: number;
	triggeredDistance: number;
	elasticCoefficient: number;
	elasticDimensionMultiplier: number;
	wheelPullPhysicalCommit: number;
	loadingThreshold: number;
}
