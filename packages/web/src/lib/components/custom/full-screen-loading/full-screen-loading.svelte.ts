/**
 * @file 全屏 Loading 命令式单例
 * @description
 * 模块级 `$state` + 引用计数：多次 `show` 需同样多次 `hide` 才关闭。
 * UI 由 `FullScreenLoadingHost` 在布局根挂载一次；`Loading.visible` 仅供 Host 绑定。
 *
 * @example
 * ```typescript
 * import { Loading } from '$lib/components/custom/full-screen-loading';
 *
 * Loading.show();
 * try {
 *   await loadSomething();
 * } finally {
 *   Loading.hide();
 * }
 * ```
 */

/** 未配对的 show 次数；>0 时 Host 显示蒙版 */
let _isLoading = $state(false);

/**
 * 全屏 loading 单例
 */
export const Loading = {
	/**
	 * 显示一层蒙版（引用 +1）
	 *
	 * @returns void
	 */
	show(): void {
		_isLoading = true;
	},

	/**
	 * 隐藏一层蒙版（引用 -1，不低于 0）
	 *
	 * @returns void
	 */
	hide(): void {
		_isLoading = false;
	},

	/**
	 * 是否当前应显示（仅供 FullScreenLoadingHost 绑定）
	 *
	 * @returns 蒙版是否应渲染
	 */
	get visible(): boolean {
		return _isLoading;
	}
};
