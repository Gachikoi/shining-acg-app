// 手势类型，每个手势库应该在这里注册自己，以区分竞态关系
export enum GestureType {
	PULL_REFRESH = 'pull-refresh',
	SWIPE = 'swipe',
	SCROLL = 'scroll'
}

// 全局手势锁
let handlingGesture: GestureType | null = $state(null);

export const createGestureController = (type: GestureType) => {
	return {
		// 是否可以处理手势：当没有其他手势处理时，可以处理手势
		canHandleGesture() {
			return handlingGesture === type || handlingGesture === null;
		},
		// 锁定仅处理当前手势
		lockGesture(): Error | null {
			if (handlingGesture === null || handlingGesture === type) {
				handlingGesture = type;
				console.debug('手势锁定', type);
				return null;
			}
			return new Error(`已被 ${handlingGesture} 手势锁定`);
		},
		// 解锁对手势处理的锁定
		unlockGesture() {
			if (handlingGesture === null || handlingGesture === type) {
				handlingGesture = null;
				console.debug('手势解锁', type);
				return null;
			}
			return new Error(`已被 ${handlingGesture} 手势锁定`);
		}
	};
};
