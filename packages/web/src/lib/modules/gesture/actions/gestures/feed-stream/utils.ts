/**
 * @file Feed 流配置合并、弹性位移映射、选项派生（`use:feedStream`、FeedPullHeader 等共用）
 */

import type { FeedStreamConfig, FeedStreamGestureOptions } from './types';

/** 默认：弹性、滚轮下拉提交量、触底距离 */
export const DEFAULT_FEED_STREAM_CONFIG: FeedStreamConfig = {
	maxDistance: 60,
	triggerThreshold: 40,
	triggeredDistance: 40,
	elasticCoefficient: 0.35,
	elasticDimensionMultiplier: 2.0,
	/** 与历史 pull-refresh wheel 通道一致的物理触发量（px·scale） */
	wheelPullPhysicalCommit: 200,
	loadingThreshold: 200
};

/**
 * 将调用方传入的部分配置与默认合并，得到手势与 UI 可用的完整配置。
 *
 * @param partial - 仅覆盖需要的字段；`undefined`/空对象 等价于全默认
 * @return 完整 `FeedStreamConfig`
 */
export function resolveFeedStreamConfig(partial?: Partial<FeedStreamConfig>): FeedStreamConfig {
	return { ...DEFAULT_FEED_STREAM_CONFIG, ...partial };
}

/**
 * 是否应启用下拉：能力未关且至少注册了一类 pull 回调。
 *
 * @param o - Action 当前 options
 * @return 是否启用 pull 识别与监听
 */
export function isPullEnabled(o: FeedStreamGestureOptions): boolean {
	return o.features?.pull !== false && !!(o.onPullMove || o.onPullEnd || o.onPullActiveChange);
}

/**
 * 是否应启用触底加载：能力未关且提供了 `onLoadMore`。
 *
 * @param o - Action 当前 options
 * @return 是否参与触底判定
 */
export function isLoadMoreEnabled(o: FeedStreamGestureOptions): boolean {
	return o.features?.loadMore !== false && !!o.onLoadMore;
}

/**
 * 是否需要注册 scroll 监听：`onScrollFrame` 或触底加载任一为真则需监听。
 *
 * @param o - Action 当前 options
 * @return 是否应绑定 scroll
 */
export function needsScrollListener(o: FeedStreamGestureOptions): boolean {
	return !!(o.onScrollFrame || isLoadMoreEnabled(o));
}

/**
 * iOS UIScrollView「橡皮筋」弹性位移公式。
 *
 * @param rawDistance - 原始拖动距离（px）
 * @param config - 弹性相关字段已解析的完整配置
 * @return 映射后的视觉位移（px）
 */
export function mapElasticDistance(rawDistance: number, config: FeedStreamConfig): number {
	const d = config.maxDistance * config.elasticDimensionMultiplier;
	const c = config.elasticCoefficient;
	return (1.0 - 1.0 / ((rawDistance * c) / d + 1.0)) * d;
}
