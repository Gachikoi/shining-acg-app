/**
 * @file 手势系统公共导出
 * @description
 * 统一导出 GestureArena 竞技场、三个 Svelte Action（swipe / pullRefresh / scrollBoundary）、
 * 所有共享类型以及默认配置。
 */

// ─── Svelte Actions ──────────────────────────────────────────────

export { swipe } from './swipe.svelte';
export { pullRefresh, DEFAULT_PULL_REFRESH_CONFIG } from './pull-refresh.svelte';
export { scrollBoundary } from './scroll-boundary.svelte';

// ─── Arena API（高级用法，消费端通常不需要直接使用） ─────────────

export {
	tryAcquire,
	release,
	isIdle,
	registerScrollBoundary,
	startAnimation,
	endAnimation
} from './arena.svelte';

// ─── 类型 ────────────────────────────────────────────────────────

export type {
	Axis,
	GestureSource,
	AcquireParams,
	ScrollBoundaryEntry,
	AnimationToken,
	SwipeState,
	SwipeOptions,
	PullRefreshConfig,
	PullRefreshOptions,
	ScrollBoundaryOptions
} from './types';
