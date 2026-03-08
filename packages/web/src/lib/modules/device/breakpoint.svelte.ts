/**
 * Tailwind CSS 响应式断点检测工具 (Svelte 5 Runes)
 *
 * 核心思路：
 * - `viewportWidth` / `rootFontSize` 用 `$state` 声明，由 resize 事件驱动更新
 * - 每个断点用 `$derived` 单独声明，而非普通 getter 读 $state
 *   原因：$derived 会在 Svelte 5 响应式图中注册为独立节点，具有缓存（值未变则不触发下游重渲染），
 *         且在任何上下文（$state({...}) 初始化、$effect、模板表达式）中均可被正确追踪；
 *         普通 getter 只有在"追踪上下文"内被调用时才会追踪依赖，在 $state({...}) 初始化时不会。
 */

/** Tailwind CSS 默认断点（rem 值） */
export const BREAKPOINTS = {
	sm: 40,
	md: 48,
	lg: 64,
	xl: 80,
	'2xl': 96
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

// ─── 核心响应式原语 ─────────────────────────────────────────────

/** 当前视口宽度 (px) */
let viewportWidth = $state(0);

/**
 * 根字体大小 (px)
 * 用于将 rem 断点值换算为 px，支持用户自定义浏览器字体大小
 */
let rootFontSize = $state(16);

// ─── 客户端初始化 ───────────────────────────────────────────────

/**
 * 读取当前 viewport 宽度和根字体大小并写入响应式状态
 * 在 resize / orientationchange 时也会调用
 */
function update() {
	viewportWidth = window.innerWidth;
	const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
	if (!isNaN(fontSize) && fontSize > 0) {
		rootFontSize = fontSize;
	}
}

// 仅在浏览器环境下初始化，SSR 阶段 viewportWidth 保持默认值 0
if (typeof window !== 'undefined') {
	update();
	window.addEventListener('resize', update, { passive: true });
	window.addEventListener('orientationchange', update, { passive: true });
}

// ─── $derived 断点状态 ──────────────────────────────────────────
// 每个断点独立派生，值未发生变化时不会触发下游重渲染（Svelte 5 派生缓存）

/** 是否 >= sm (40rem / 640px) */
const isSm = $derived(viewportWidth >= BREAKPOINTS.sm * rootFontSize);

/** 是否 >= md (48rem / 768px) */
const isMd = $derived(viewportWidth >= BREAKPOINTS.md * rootFontSize);

/** 是否 >= lg (64rem / 1024px) */
const isLg = $derived(viewportWidth >= BREAKPOINTS.lg * rootFontSize);

/** 是否 >= xl (80rem / 1280px) */
const isXl = $derived(viewportWidth >= BREAKPOINTS.xl * rootFontSize);

/** 是否 >= 2xl (96rem / 1536px) */
const is2xl = $derived(viewportWidth >= BREAKPOINTS['2xl'] * rootFontSize);

/**
 * 当前最大激活断点
 * 视口宽度小于 sm 时返回 undefined
 */
const current = $derived<BreakpointKey | undefined>(
	is2xl ? '2xl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : undefined
);

// ─── rem / px 转换工具 ──────────────────────────────────────────

/**
 * 将 rem 值转换为 px（基于当前根字体大小，响应式）
 *
 * rootFontSize 由 resize / orientationchange 事件驱动更新，
 * 在 $derived / $effect / 模板表达式中调用可正确追踪依赖。
 *
 * @param rem - rem 值
 * @returns px 值
 */
export function remToPx(rem: number): number {
	return rem * rootFontSize;
}

/**
 * 将 px 值转换为 rem（基于当前根字体大小，响应式）
 *
 * @param px - px 值
 * @returns rem 值
 */
export function pxToRem(px: number): number {
	return px / rootFontSize;
}

// ─── 公开 API ───────────────────────────────────────────────────

/**
 * 全局响应式断点对象，可直接在组件模板或 $derived / $effect 中使用。
 *
 * @example
 * ```svelte
 * <script>
 *   import { breakpoint } from '$lib/modules/device';
 * </script>
 *
 * <!-- 模板中直接读取，完全响应式 -->
 * {#if breakpoint.isMd}
 *   <DesktopLayout />
 * {/if}
 *
 * <!-- script 中需配合 $derived 才有响应式 -->
 * let cols = $derived(breakpoint.isMd ? 2 : 1);
 * ```
 */
export const breakpoint = {
	/** 当前视口宽度 (px) */
	get width() {
		return viewportWidth;
	},

	/** 当前最大激活断点，视口 < sm 时为 undefined */
	get current() {
		return current;
	},

	/** 是否 >= sm (640px) */
	get isSm() {
		return isSm;
	},

	/** 是否 >= md (768px) */
	get isMd() {
		return isMd;
	},

	/** 是否 >= lg (1024px) */
	get isLg() {
		return isLg;
	},

	/** 是否 >= xl (1280px) */
	get isXl() {
		return isXl;
	},

	/** 是否 >= 2xl (1536px) */
	get is2xl() {
		return is2xl;
	},

	/**
	 * 检查视口是否满足指定断点
	 *
	 * @param key - 断点名称
	 * @returns 是否满足该断点
	 */
	check(key: BreakpointKey): boolean {
		return viewportWidth >= BREAKPOINTS[key] * rootFontSize;
	}
};
