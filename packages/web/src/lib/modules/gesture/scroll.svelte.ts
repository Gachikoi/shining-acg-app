import type { Action } from 'svelte/action';
import { GestureType, createGestureController } from './controller.svelte';

export const scroll: Action = (node) => {
	const { canHandleGesture, lockGesture, unlockGesture } = createGestureController(
		GestureType.SCROLL
	);

	const handleTouchStart = () => {
		if (!canHandleGesture()) return;

		// 垂直方向：内容高度 > 可视高度 → 需要滚动
		const needsVerticalScroll = node.scrollHeight > node.clientHeight;
		// 水平方向：内容宽度 > 可视宽度 → 需要滚动
		const needsHorizontalScroll = node.scrollWidth > node.clientWidth;

		if (!needsVerticalScroll && !needsHorizontalScroll) return;

		// 如果元素可以滚动才锁定手势
		lockGesture();
	};

	const handleTouchEnd = () => {
		if (!canHandleGesture()) return;
		unlockGesture();
	};

	const handleTouchCancel = () => {
		if (!canHandleGesture()) return;
		unlockGesture();
	};

	$effect(() => {
		node.addEventListener('touchstart', handleTouchStart);
		node.addEventListener('touchend', handleTouchEnd);
		node.addEventListener('touchcancel', handleTouchCancel);

		return () => {
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchend', handleTouchEnd);
			node.removeEventListener('touchcancel', handleTouchCancel);
		};
	});
};
