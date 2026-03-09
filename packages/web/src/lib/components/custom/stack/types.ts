/**
 * @file Stack 堆叠布局类型定义
 * @description 导出所有与堆叠布局相关的 TypeScript 类型
 */

import type { Component } from 'svelte';

/**
 * 懒加载组件的 loader 函数类型
 *
 * 用于解决子组件 push 父组件（或自身）时产生的循环 import 问题。
 * 动态 import 在运行时求值，不参与模块初始化的静态依赖图。
 *
 * @template TProps - 目标组件的 props 类型
 *
 * @example
 * // 组件 push 自身（self-reference）
 * push({ loader: () => import('./my-page.svelte'), props: { id: '456' } });
 *
 * // 子组件 push 父组件（避免循环 import）
 * push({ loader: () => import('../parent-page.svelte'), props: {} });
 */
export type ComponentLoader<TProps extends Record<string, unknown> = Record<string, unknown>> =
	() => Promise<{ default: Component<TProps> }>;

/**
 * 栈中单个元素的描述结构
 *
 * `component` 为 null 表示懒加载仍在进行中，
 * loader resolve 后由 push 内部写入真实组件引用。
 */
export interface StackItem {
	/** 元素唯一标识符（由 push 自动生成，基于 crypto.randomUUID） */
	id: string;
	/**
	 * 要渲染的 Svelte 5 组件
	 * - 静态 push：组件引用直接传入，立即可用
	 * - 懒加载 push：loader resolve 前为 null，resolve 后由 push 写入
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	component: Component<any> | null;
	/** 传递给组件的 props */
	props: Record<string, unknown>;
	onLeftSwipe?: () => void;
}

// ─── PushOptions 判别联合 ─────────────────────────────────────────
// 使用 `'loader' in options` 在运行时区分两种形式，
// TypeScript 的 in 类型守卫能自动收窄到对应子类型。

/**
 * 静态 push：直接传入已 import 的组件引用
 *
 * 适用于无循环依赖的情况（子组件 push 其他独立页面）。
 *
 * @template TProps - 组件 props 类型
 */
export interface StaticPushOptions<
	TProps extends Record<string, unknown> = Record<string, unknown>
> {
	/** 已 import 的 Svelte 5 组件引用 */
	component: Component<TProps>;
	/** 传递给组件的 props，默认为空对象 */
	props?: TProps;
}

/**
 * 懒加载 push：传入动态 import loader 函数
 *
 * 适用于有循环依赖（push 父组件 / push 自身）的情况。
 * 动态 import 在运行时求值，模块已缓存时几乎无延迟；
 * 首次加载时会出现加载态（全屏居中 spinner）。
 *
 * @template TProps - 组件 props 类型
 */
export interface LazyPushOptions<TProps extends Record<string, unknown> = Record<string, unknown>> {
	/** 动态 import 函数，返回包含组件默认导出的 Promise */
	loader: ComponentLoader<TProps>;
	/** 传递给组件的 props，默认为空对象 */
	props?: TProps;
}

/**
 * push 操作的入参类型（判别联合）
 *
 * @template TProps - 组件 props 类型
 *
 * @example
 * // 静态 push
 * push({ component: DetailPage, props: { id: '123' } });
 *
 * // 懒加载 push（解决循环依赖）
 * push({ loader: () => import('./detail-page.svelte'), props: { id: '123' } });
 */
export type PushOptions<TProps extends Record<string, unknown> = Record<string, unknown>> =
	| StaticPushOptions<TProps>
	| LazyPushOptions<TProps>;

/**
 * StackContainer 的布局与行为配置
 */
export interface StackContainerProps {
	/**
	 * z-index 基础值，栈中第一个元素（栈底）的 z-index
	 * 每个后续元素递增 1，确保栈顶元素始终在最上层
	 * @default 100
	 */
	zIndexBase?: number;
	/**
	 * 最大同时渲染的栈元素数量
	 *
	 * 超出此数量的较早入栈元素将卸载 DOM（节省内存），
	 * 但依然保留在栈状态中；当其重新进入可见范围时会重新挂载。
	 * 组件自身负责在 onMount 时恢复状态（例如从自身缓存读取）。
	 *
	 * 不传或传 undefined 表示不限制渲染数量。
	 */
	maxVisible?: number;
}
