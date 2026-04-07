/**
 * @file 手势系统公共导出
 * @description
 * 仅导出供业务使用的 Svelte Action 与对应选项类型；`core/arena` 与 `core/types` 为模块内部实现细节，
 * 不在此 re-export。模块内请使用相对路径或 `$lib/modules/gesture/core/*` 直接引用。
 */

// ─── Svelte Actions（registry：登记供竞技场查询；gestures：完整输入闭环） ─

export { edgeZone } from './actions/registry/edge-zone';
export { scrollBoundary } from './actions/registry/scroll-boundary';

// ─── 各 Action 专属类型（自子模块再导出） ─────────────────────────

export * from './actions/gestures';
export type { EdgeZoneOptions } from './actions/registry/edge-zone';
export type { ScrollBoundaryOptions } from './actions/registry/scroll-boundary';
