/**
 * @module image-controller
 *
 * **职责**：封装 `ImageVideoPreview` 中“图片域”的手势与动画逻辑。
 * - **edge pull**：首尾自由拖拽（dx/dy）→ scale/backdropAlpha 联动 → 松手回弹
 * - **dismiss**：拖拽超阈值后触发飞回（`animateFlyToRect`）
 * - **输出**：`edgePullBlank`（用于父级盖空白层）与 `onEdgePullStateChange`（更通用的状态）
 *
 * **说明**：控制器不直接操作 DOM，只通过注入的 rect 读取函数与回调协调外层。
 */
import type { SwipeState } from '$lib/modules/gesture';
import {
	applyCommittedCarouselSwipe,
	computeImageSwipeMove
} from '../gestures/image-preview-swipe-logic';
import { animateFlyToRect, type FlyToRectOptions } from '../utils/fly-to-rect';

export type EdgePullMode = 'none' | 'rubber-band';

export type EdgePullState = {
	mode: EdgePullMode;
	isEdgePulling: boolean;
	dx: number;
	dy: number;
	dist: number;
	scale: number;
	backdropAlpha: number;
	isBlank: boolean;
};

export type ImageController = ReturnType<typeof createImageController>;

type CreateImageControllerInput = {
	fullScreen: () => boolean;
	isMobile: () => boolean;
	isImage: () => boolean;
	mediaCount: () => number;
	getCurrentIndex: () => number;
	getMediaDisplayUrl: () => string;
	getGestureRect: () => DOMRect | null;
	getPreviewFlySourceRect: () => DOMRect | null;
	getDismissTargetRect: () => DOMRect | null;
	onRequestClose: () => void;
	onRequestPrev: () => void;
	onRequestNext: () => void;
	onEdgePullBlankChange?: (blank: boolean) => void;
};

export function createImageController(input: CreateImageControllerInput) {
	let edgePullMode = $state<EdgePullMode>('rubber-band');
	let edgePullBlank = $state(false);

	let panOffsetX = $state(0);
	let isPanning = $state(false);
	let imageEdgePullDx = $state(0);
	let imageEdgePullDy = $state(0);

	let imageEdgeBackdropAlpha = $state(1);
	let edgePullBackdropTransition = $state(false);
	let isFlyClosing = $state(false);

	let edgeSpringCloseTimer: ReturnType<typeof setTimeout> | null = null;
	const IMAGE_EDGE_PULL_DENOM_RATIO = 0.95;
	const IMAGE_EDGE_DISMISS_RATIO = 0.2;
	const IMAGE_EDGE_SPRING_MS = 1150;

	const edgePullState: EdgePullState = {
		mode: 'rubber-band',
		isEdgePulling: false,
		dx: 0,
		dy: 0,
		dist: 0,
		scale: 1,
		backdropAlpha: 1,
		isBlank: false
	};

	let onEdgePullStateChange: ((state: EdgePullState) => void) | undefined;

	function setEdgePullMode(mode: EdgePullMode) {
		edgePullMode = mode;
	}
	function setOnEdgePullStateChange(fn?: (state: EdgePullState) => void) {
		onEdgePullStateChange = fn;
	}

	function clearEdgeSpringCloseTimer() {
		if (edgeSpringCloseTimer !== null) {
			clearTimeout(edgeSpringCloseTimer);
			edgeSpringCloseTimer = null;
		}
	}

	function pullDistToBackdropAlpha(dist: number): number {
		const r = input.getGestureRect();
		const w = r?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 400);
		const h = r?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 400);
		const denom = Math.min(w, h) * IMAGE_EDGE_PULL_DENOM_RATIO;
		const t = Math.min(1, dist / denom);
		return Math.max(0.04, 1 - 0.9 * t);
	}

	function syncImageEdgeBackdropAlpha() {
		if (!input.fullScreen() || !input.isImage()) {
			imageEdgeBackdropAlpha = 1;
			return;
		}
		const d = Math.hypot(imageEdgePullDx, imageEdgePullDy);
		imageEdgeBackdropAlpha = d > 0 ? pullDistToBackdropAlpha(d) : 1;
	}

	function getEdgePullDist(): number {
		return Math.hypot(imageEdgePullDx, imageEdgePullDy);
	}

	function getEdgePullScale(): number {
		const dist = getEdgePullDist();
		if (!input.isImage() || dist === 0) return 1;
		const r = input.getGestureRect();
		const w = r?.width ?? 400;
		const h = r?.height ?? 400;
		const denom = Math.min(w, h) * IMAGE_EDGE_PULL_DENOM_RATIO;
		const t = Math.min(1, dist / denom);
		return 1 - 0.76 * t;
	}

	function setEdgePullBlank(next: boolean) {
		edgePullBlank = next;
		input.onEdgePullBlankChange?.(next);
	}

	function emitEdgePullStateChange() {
		if (!onEdgePullStateChange) return;
		edgePullState.mode = edgePullMode;
		edgePullState.dx = imageEdgePullDx;
		edgePullState.dy = imageEdgePullDy;
		edgePullState.dist = getEdgePullDist();
		edgePullState.scale = getEdgePullScale();
		edgePullState.backdropAlpha = imageEdgeBackdropAlpha;
		edgePullState.isBlank = edgePullBlank;
		edgePullState.isEdgePulling =
			input.isImage() && edgePullMode !== 'none' && edgePullState.dist > 0;
		onEdgePullStateChange(edgePullState);
	}

	async function flyImageCloseToSlot() {
		clearEdgeSpringCloseTimer();
		const hostRect = input.getGestureRect();
		if (!input.isImage() || !hostRect || typeof document === 'undefined') {
			input.onRequestClose();
			return;
		}

		const fromRect = input.getPreviewFlySourceRect() ?? hostRect;
		const toRect = input.getDismissTargetRect();
		if (!toRect || toRect.width < 4 || toRect.height < 4) {
			input.onRequestClose();
			return;
		}

		const opts: FlyToRectOptions = {
			srcUrl: input.getMediaDisplayUrl(),
			fromRect,
			toRect,
			durationMs: 520,
			easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
			opacityTo: 1
		};

		try {
			// 进入飞回：隐藏预览层本体，仅保留飞回 img
			isFlyClosing = true;
			await animateFlyToRect(opts);
		} catch {
			// ignore
		} finally {
			input.onRequestClose();
		}
	}

	function onSwipeStart() {
		const hadPendingSettle = edgeSpringCloseTimer !== null;
		clearEdgeSpringCloseTimer();
		edgePullBackdropTransition = false;
		if (hadPendingSettle) {
			setEdgePullBlank(false);
		}
		isPanning = true;
		imageEdgePullDx = 0;
		imageEdgePullDy = 0;
		syncImageEdgeBackdropAlpha();
		emitEdgePullStateChange();
	}

	function onSwipeMove(state: SwipeState) {
		const rect = input.getGestureRect();
		const w = rect?.width ?? 400;
		const m = computeImageSwipeMove({
			deltaX: state.deltaX,
			deltaY: state.deltaY,
			containerWidth: w,
			currentIndex: input.getCurrentIndex(),
			mediaCount: input.mediaCount(),
			isMobile: input.isMobile(),
			isImage: input.isImage() && edgePullMode !== 'none'
		});
		panOffsetX = m.panOffsetX;
		imageEdgePullDx = edgePullMode !== 'none' ? m.imageEdgePullDx : 0;
		imageEdgePullDy = edgePullMode !== 'none' ? m.imageEdgePullDy : 0;
		setEdgePullBlank(edgePullMode !== 'none' ? m.edgePullBlank : false);
		syncImageEdgeBackdropAlpha();
		emitEdgePullStateChange();
	}

	function onSwipeEnd(state: SwipeState) {
		const rect = input.getGestureRect();
		const w = rect?.width ?? 400;
		const h = rect?.height ?? 400;
		const minDim = Math.min(w, h);
		const pullDist = getEdgePullDist();
		const thresholdPx = minDim * IMAGE_EDGE_DISMISS_RATIO;
		const wasImageFreePull = input.isImage() && edgePullMode !== 'none' && edgePullBlank;

		if (wasImageFreePull) {
			panOffsetX = 0;
			if (pullDist >= thresholdPx) {
				isPanning = false;
				imageEdgePullDx = 0;
				imageEdgePullDy = 0;
				syncImageEdgeBackdropAlpha();
				emitEdgePullStateChange();
				void flyImageCloseToSlot();
				return;
			}
			// 未达飞回阈值：弹回后保持全屏；仅撤外部联动遮罩（与 `IMAGE_EDGE_SPRING_MS` 对齐）
			isPanning = false;
			edgePullBackdropTransition = true;
			requestAnimationFrame(() => {
				imageEdgePullDx = 0;
				imageEdgePullDy = 0;
				requestAnimationFrame(() => {
					imageEdgeBackdropAlpha = 1;
					emitEdgePullStateChange();
				});
				clearEdgeSpringCloseTimer();
				edgeSpringCloseTimer = setTimeout(() => {
					edgeSpringCloseTimer = null;
					edgePullBackdropTransition = false;
					setEdgePullBlank(false);
					emitEdgePullStateChange();
				}, IMAGE_EDGE_SPRING_MS);
			});
			emitEdgePullStateChange();
			return;
		}

		isPanning = false;
		imageEdgePullDx = 0;
		imageEdgePullDy = 0;
		setEdgePullBlank(false);
		syncImageEdgeBackdropAlpha();
		emitEdgePullStateChange();

		applyCommittedCarouselSwipe(state, {
			mediaCount: input.mediaCount(),
			currentIndex: input.getCurrentIndex(),
			onPrev: input.onRequestPrev,
			onNext: input.onRequestNext
		});
		panOffsetX = 0;
	}

	function resetOnOpen() {
		clearEdgeSpringCloseTimer();
		edgePullBackdropTransition = false;
		imageEdgeBackdropAlpha = 1;
		panOffsetX = 0;
		imageEdgePullDx = 0;
		imageEdgePullDy = 0;
		setEdgePullBlank(false);
		isPanning = false;
		isFlyClosing = false;
		emitEdgePullStateChange();
	}

	return {
		state: {
			get edgePullMode() {
				return edgePullMode;
			},
			get edgePullBlank() {
				return edgePullBlank;
			},
			get panOffsetX() {
				return panOffsetX;
			},
			get isPanning() {
				return isPanning;
			},
			get imageEdgePullDx() {
				return imageEdgePullDx;
			},
			get imageEdgePullDy() {
				return imageEdgePullDy;
			},
			get imageEdgePullScale() {
				return getEdgePullScale();
			},
			get imageEdgeBackdropAlpha() {
				return imageEdgeBackdropAlpha;
			},
			get edgePullBackdropTransition() {
				return edgePullBackdropTransition;
			},
			get isFlyClosing() {
				return isFlyClosing;
			}
		},
		config: { setEdgePullMode, setOnEdgePullStateChange },
		actions: { onSwipeStart, onSwipeMove, onSwipeEnd, resetOnOpen }
	};
}
