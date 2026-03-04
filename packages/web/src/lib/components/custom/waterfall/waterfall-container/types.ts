import type { V1PostPreview } from '$lib/api/types.gen';

export interface WaterfallData {
	posts: V1PostPreview[];
	loading: boolean;
	refreshing: boolean;
	hasMore: boolean;
	cursor: string | null;
	loadMore: () => Promise<void>;
	refresh: () => Promise<void>;
}

export type WaterfallConfigKey =
	| 'minCardWidth'
	| 'gap'
	| 'bufferSize'
	| 'bufferHeight'
	| 'loadingThreshold'
	| 'cardContentHeight'
	| 'scene'
	| 'skeletonCardCount'
	| 'binarySearchThreshold';

export interface WaterfallConfig {
	minCardWidth: number;
	gap: number;
	bufferSize: number;
	bufferHeight: number;
	loadingThreshold: number;
	cardContentHeight: number;
	skeletonCardCount: number;
	binarySearchThreshold: number;
	pullRefreshConfig: PullRefreshConfig;
}

export interface PullRefreshConfig {
	maxDistance: number;
	triggerThreshold: number;
	triggeredDistance: number;
	dampingFactor: number;
	functionalRefreshDuration: number;
}

export interface CardPosition {
	top: number;
	left: number;
	width: number;
	height: number;
}

export function isValidWaterfallData(data: unknown): data is WaterfallData {
	if (typeof data !== 'object' || data === null) return false;

	const d = data as Record<string, unknown>;

	return (
		Array.isArray(d.posts) &&
		typeof d.loading === 'boolean' &&
		typeof d.refreshing === 'boolean' &&
		typeof d.hasMore === 'boolean' &&
		(d.cursor === null || typeof d.cursor === 'string') &&
		typeof d.loadMore === 'function' &&
		typeof d.refresh === 'function'
	);
}

export function isValidWaterfallConfig(config: unknown): config is WaterfallConfig {
	if (typeof config !== 'object' || config === null) return false;

	const c = config as Record<string, unknown>;

	return (
		typeof c.minCardWidth === 'number' &&
		c.minCardWidth > 0 &&
		typeof c.gap === 'number' &&
		c.gap >= 0 &&
		typeof c.bufferSize === 'number' &&
		c.bufferSize > 0 &&
		typeof c.bufferHeight === 'number' &&
		c.bufferHeight > 0 &&
		typeof c.loadingThreshold === 'number' &&
		c.loadingThreshold >= 0 &&
		typeof c.cardContentHeight === 'number' &&
		c.cardContentHeight >= 0 &&
		typeof c.scene === 'string' &&
		typeof c.skeletonCardCount === 'number' &&
		c.skeletonCardCount >= 0 &&
		typeof c.binarySearchThreshold === 'number' &&
		c.binarySearchThreshold > 0
	);
}
