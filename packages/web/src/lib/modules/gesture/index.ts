/**
 * @file 手势系统公共导出
 * @description
 * 统一导出 GestureArena（`core`）、全部 Svelte Action（位于 `actions/registry` 与 `actions/gestures`，含 `dragReorder`）、
 * 共享类型与默认配置。业务侧请只从本文件导入，勿依赖子路径。
 */

// ─── Svelte Actions（registry：登记供竞技场查询；gestures：完整输入闭环） ─

export { edgeZone } from './actions/registry/edge-zone';
export { dragReorder, findListItemIndexUnderPoint } from './drag-reorder';
export type { DragReorderDragPreview, DragReorderOptions } from './drag-reorder';
export { DEFAULT_PULL_REFRESH_CONFIG, pullRefresh } from './actions/gestures/pull-refresh';
export { scrollBoundary } from './actions/registry/scroll-boundary';
export { swipe } from './actions/gestures/swipe';

// ─── Arena API（高级用法，消费端通常不需要直接使用） ─────────────

export {
	endAnimation,
	isIdle,
	registerEdgeZone,
	registerScrollBoundary,
	release,
	startAnimation,
	tryAcquire
} from './core/arena.svelte';

// ─── 公共类型（core） ────────────────────────────────────────────

export type {
	AcquireParams,
	AnimationToken,
	Axis,
	GestureSource,
	ScrollBoundaryEntry
} from './core/types';

// ─── 各 Action 专属类型（自子模块再导出） ─────────────────────────

export type { EdgeZoneOptions } from './actions/registry/edge-zone';
export type { PullRefreshConfig, PullRefreshOptions } from './actions/gestures/pull-refresh';
export type { ScrollBoundaryOptions } from './actions/registry/scroll-boundary';
export type { SwipeOptions, SwipeState } from './actions/gestures/swipe';

export * from './actions/gestures/long-press';
export * from './actions/gestures/tap';
