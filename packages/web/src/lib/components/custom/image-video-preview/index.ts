/**
 * 图片/视频全屏预览组件，实现位于 `index.svelte`（与子组件 `Image-preview` / `Video-preview` 配套）。
 */
export { default as ImageVideoPreview } from './index.svelte';
export {
	applyCommittedCarouselSwipe,
	computeImageSwipeMove,
	computeInlineCarouselPan,
	PAN_MAX_OFFSET_RATIO,
	type CommittedCarouselSwipeParams,
	type ImageSwipeMoveInput,
	type ImageSwipeMoveResult,
	type InlineCarouselPanInput
} from './image-preview-swipe-logic';
