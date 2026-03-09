/**
 * @file Stack 堆叠布局模块公开 API
 * @description
 * 导出 Stack 堆叠布局基建的所有公开接口：
 * - 组件：StackContainer（挂在布局层）
 * - 状态操作：push / pop / popById / clearStack
 * - 只读状态：stackState
 * - 类型：StackItem / PushOptions / StackConfig / StackContainerProps
 *
 * @example
 * ```svelte
 * <!-- +layout.svelte -->
 * <script>
 *   import { StackContainer } from '$lib/components/custom/stack';
 * </script>
 * <StackContainer zIndexBase={100} maxVisible={5} />
 * ```
 *
 * @example
 * ```typescript
 * import  stackController  from '$lib/components/custom/stack';
 * import DetailPage from './detail-page.svelte';
 *
 * // 入栈
 * push({ component: DetailPage, props: { id: '123' } });
 *
 * // 出栈
 * pop();
 *
 * // 读取栈深度
 * stackState.length;
 * ```
 */

// ─── 组件 ────────────────────────────────────────────────────────
export { default as StackContainer } from './stack-container.svelte';

// ─── 状态操作函数 ────────────────────────────────────────────────
export { default as stackController } from './stack.svelte';

// ─── 类型 ────────────────────────────────────────────────────────
export type {
	StackItem,
	PushOptions,
	StaticPushOptions,
	LazyPushOptions,
	ComponentLoader,
	StackContainerProps
} from './types';
