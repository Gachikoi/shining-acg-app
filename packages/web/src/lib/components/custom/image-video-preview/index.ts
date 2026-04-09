/**
 * `ImageVideoPreview` 组件族入口。\n
 * - UI：`index.svelte` + `views/*`\n
 * - 逻辑：`controllers/*`\n
 * - 纯函数：`gestures/*`\n
 * - 工具：`utils/*`\n
 */
export { default as ImageVideoPreview } from './index.svelte';
export { animateFlyToRect, type FlyToRectOptions } from './utils/fly-to-rect';
export {
	applyCommittedCarouselSwipe,
	computeImageSwipeMove,
	computeInlineCarouselPan,
	PAN_MAX_OFFSET_RATIO,
	type CommittedCarouselSwipeParams,
	type ImageSwipeMoveInput,
	type ImageSwipeMoveResult,
	type InlineCarouselPanInput
} from './gestures/image-preview-swipe-logic';
