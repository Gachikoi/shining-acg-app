/**
 * @file 手势系统公共导出
 * @description
 * 统一导出 GestureArena 竞技场、三个 Svelte Action（swipe / pullRefresh / scrollBoundary）、
 * 所有共享类型以及默认配置。
 */

// ─── Svelte Actions ──────────────────────────────────────────────

export { longPress } from './long-press/long-press.svelte';
export { DEFAULT_PULL_REFRESH_CONFIG, pullRefresh } from './pull-refresh.svelte';
export { scrollBoundary } from './scroll-boundary.svelte';
export { swipe } from './swipe.svelte';
export { tap } from './tap/tap.svelte';

// ─── Arena API（高级用法，消费端通常不需要直接使用） ─────────────

export {
	endAnimation,
	isIdle,
	registerScrollBoundary,
	release,
	startAnimation,
	tryAcquire
} from './arena.svelte';

// ─── 类型 ────────────────────────────────────────────────────────

export type {
	AcquireParams,
	AnimationToken,
	Axis,
	GestureSource,
	PullRefreshConfig,
	PullRefreshOptions,
	ScrollBoundaryEntry,
	ScrollBoundaryOptions,
	SwipeOptions,
	SwipeState
} from './types';

export * from './long-press';
export * from './tap';
