/**
 * 全屏预览与帖内轮播共用的横向 swipe 纯函数（单测与组件瘦身）。
 */

import type { SwipeState } from '$lib/modules/gesture';

export const PAN_MAX_OFFSET_RATIO = 1.2;

export type ImageSwipeMoveInput = {
	deltaX: number;
	deltaY: number;
	containerWidth: number;
	currentIndex: number;
	mediaCount: number;
	isMobile: boolean;
	isImage: boolean;
};

export type ImageSwipeMoveResult = {
	panOffsetX: number;
	imageEdgePullDx: number;
	imageEdgePullDy: number;
	edgePullBlank: boolean;
};

/**
 * @param input - 当前帧位移与媒体上下文
 * @returns 写入组件 state 的四个字段
 */
export function computeImageSwipeMove(input: ImageSwipeMoveInput): ImageSwipeMoveResult {
	const {
		deltaX: dx,
		deltaY: dy,
		containerWidth: w,
		currentIndex,
		mediaCount,
		isMobile,
		isImage
	} = input;
	const max = w * PAN_MAX_OFFSET_RATIO;
	const atFirst = currentIndex === 0;
	const atLast = currentIndex === mediaCount - 1;
	const single = mediaCount === 1;
	const horizontalDominant = Math.abs(dx) >= Math.abs(dy) * 1.1;

	if (!isMobile && isImage) {
		return {
			imageEdgePullDx: 0,
			imageEdgePullDy: 0,
			edgePullBlank: false,
			panOffsetX: mediaCount <= 1 ? 0 : Math.max(-max, Math.min(max, dx))
		};
	}

	if (!isImage) {
		return {
			imageEdgePullDx: 0,
			imageEdgePullDy: 0,
			edgePullBlank: false,
			panOffsetX: Math.max(-max, Math.min(max, dx))
		};
	}

	if (single) {
		return { imageEdgePullDx: dx, imageEdgePullDy: dy, panOffsetX: 0, edgePullBlank: true };
	}

	if (atFirst) {
		if (horizontalDominant && dx <= 0) {
			return {
				imageEdgePullDx: 0,
				imageEdgePullDy: 0,
				edgePullBlank: false,
				panOffsetX: Math.max(-max, Math.min(max, dx))
			};
		}
		return { imageEdgePullDx: dx, imageEdgePullDy: dy, panOffsetX: 0, edgePullBlank: true };
	}

	if (atLast) {
		if (horizontalDominant && dx >= 0) {
			return {
				imageEdgePullDx: 0,
				imageEdgePullDy: 0,
				edgePullBlank: false,
				panOffsetX: Math.max(-max, Math.min(max, dx))
			};
		}
		return { imageEdgePullDx: dx, imageEdgePullDy: dy, panOffsetX: 0, edgePullBlank: true };
	}

	if (horizontalDominant) {
		return {
			imageEdgePullDx: 0,
			imageEdgePullDy: 0,
			edgePullBlank: false,
			panOffsetX: Math.max(-max, Math.min(max, dx))
		};
	}

	return { imageEdgePullDx: dx, imageEdgePullDy: dy, panOffsetX: 0, edgePullBlank: true };
}

// ─── 帖内媒体区轮播（PostMediaArea）：仅横向跟手 + 首尾橡皮筋 ─────────────

export type InlineCarouselPanInput = {
	deltaX: number;
	containerWidth: number;
	activeIndex: number;
	mediaCount: number;
};

/**
 * 帖内 `translate3d` 轨道跟手位移：单图无位移；首张禁右拉、末张禁左拉；其余 clamp 到 ±`PAN_MAX_OFFSET_RATIO * width`。
 *
 * @param input - 手势 delta 与当前索引、媒体条数、容器宽
 * @returns 写入 `panOffsetX` 的像素值
 */
export function computeInlineCarouselPan(input: InlineCarouselPanInput): number {
	const max = input.containerWidth * PAN_MAX_OFFSET_RATIO;
	let dx = input.deltaX;
	const last = input.mediaCount - 1;
	if (input.mediaCount <= 1) dx = 0;
	else if (input.activeIndex === 0 && dx > 0) dx = 0;
	else if (input.activeIndex === last && dx < 0) dx = 0;
	return Math.max(-max, Math.min(max, dx));
}

export type CommittedCarouselSwipeParams = {
	mediaCount: number;
	currentIndex: number;
	onPrev: () => void;
	onNext: () => void;
};

/**
 * 多页横向列表在 swipe `onEnd` 时的统一翻页：仅 `committed` 且多于一条媒体时，按方向调用上一页/下一页（首尾不越界）。
 *
 * @param state - `use:swipe` 结束态（需 `committed` 与 `direction`）
 * @param params - 条数、当前索引与回调
 */
export function applyCommittedCarouselSwipe(
	state: Pick<SwipeState, 'committed' | 'direction'>,
	params: CommittedCarouselSwipeParams
): void {
	if (!state.committed || params.mediaCount <= 1) return;
	if (state.direction === 'right' && params.currentIndex > 0) {
		params.onPrev();
	} else if (state.direction === 'left' && params.currentIndex < params.mediaCount - 1) {
		params.onNext();
	}
}
