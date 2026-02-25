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

export interface WaterfallConfig {
	minCardWidth: number;
	gap: number;
	bufferSize: number;
	loadingThreshold: number;
	scene: string;
	needNum: number;
}

export interface CardPosition {
	top: number;
	left: number;
	width: number;
	height: number;
}

export interface ColumnHeight {
	height: number;
	index: number;
}
