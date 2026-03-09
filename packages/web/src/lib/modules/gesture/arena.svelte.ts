/**
 * @file GestureArena — 手势竞技场单例
 * @description
 * 灵感来自 Flutter 的手势竞技场，适配 Web DOM 事件冒泡模型。
 *
 * 核心职责：
 * 1. **竞态裁决**：多个手势识别器同时竞争时，通过 tryAcquire 仲裁谁有资格处理。
 * 2. **边界让渡**：同轴冲突时，子区域还能在当前方向滚动就让子处理，到边界才让渡给父。
 * 3. **动画保护 (AnimationGuard)**：手势后衔接的 Spring 动画有可打断/不可打断两种模式，
 *    在动画播放期间协调新手势的准入。
 *
 * 所有状态为模块级单例，使用 Svelte 5 runes 实现响应式。
 */

import type { AcquireParams, AnimationToken, ScrollBoundaryEntry } from './types';

// ─── 单例状态 ────────────────────────────────────────────────────
// 注意：此处有意不使用 $state。
// 竞技场状态仅由命令式函数（tryAcquire / release / startAnimation）读写，
// 不参与任何 Svelte 模板或 $derived 响应式链。
// 使用 $state 会导致对象被 proxy 包装，在 .then() 回调中做 === 比较时
// proxy !== 原始对象，引发 state_proxy_equality_mismatch 警告，
// 并导致动画令牌永远无法清理，阻塞所有后续手势。

/**
 * 当前持有控制权的手势
 * null 表示竞技场空闲，任何手势都可竞争
 */
let activeGesture: { id: string; type: string } | null = null;

/**
 * 当前正在播放的手势后动画
 * null 表示无动画，手势可自由进入
 */
let animationState: AnimationToken | null = null;

/**
 * 已注册的可滚动边界区域
 * key 为 DOM 节点，value 为边界查询接口
 */
const scrollBoundaries = new Map<HTMLElement, ScrollBoundaryEntry>();

// ─── 公共 API ────────────────────────────────────────────────────

/**
 * 手势识别器尝试获取竞技场控制权
 *
 * 裁决流程（按顺序）：
 * 1. **动画保护检查**：如有不可打断动画 → reject；
 *    如有可打断动画但发起者非同类型 → reject；
 *    如有可打断动画且同类型 → cancel 动画后继续
 * 2. **重复持有检查**：已被同 ID 持有 → grant（幂等）
 * 3. **互斥检查**：已被其他 ID 持有 → reject
 * 4. **边界让渡检查**：在请求的轴+方向上，pointerTarget 所在的子级
 *    scrollBoundary 是否还能滚动？能 → reject（让子处理）
 * 5. 以上全部通过 → grant
 *
 * @param params - 申请参数
 * @returns true 表示获得控制权（grant），false 表示被拒绝（reject）
 */
export function tryAcquire(params: AcquireParams): boolean {
	// 1. AnimationGuard
	if (animationState) {
		if (!animationState.interruptible) {
			return false;
		}
		if (animationState.owner !== params.type) {
			return false;
		}
		// 同类型 + 可打断 → 取消当前动画
		animationState.cancel();
		animationState = null;
	}

	// 2. 幂等：已由同一识别器持有
	if (activeGesture && activeGesture.id === params.id) {
		return true;
	}

	// 3. 互斥：已被其他识别器持有
	if (activeGesture && activeGesture.id !== params.id) {
		return false;
	}

	// 4. 边界让渡：检查子级可滚动区域
	for (const [boundaryNode, entry] of scrollBoundaries) {
		const isChildOfGesture = params.node.contains(boundaryNode);
		const containsPointer = boundaryNode.contains(params.pointerTarget);

		if (isChildOfGesture && containsPointer) {
			if (entry.canScroll(params.axis, params.direction)) {
				return false;
			}
		}
	}

	// 5. Grant
	activeGesture = { id: params.id, type: params.type };
	return true;
}

/**
 * 手势识别器释放竞技场控制权
 *
 * @param id - 识别器实例 ID，只有持有者才能释放
 */
export function release(id: string): void {
	if (activeGesture?.id === id) {
		activeGesture = null;
	}
}

/**
 * 查询竞技场是否空闲（无活跃手势且无不可打断动画）
 *
 * @returns true 表示空闲
 */
export function isIdle(): boolean {
	if (activeGesture) return false;
	if (animationState && !animationState.interruptible) return false;
	return true;
}

// ─── ScrollBoundary 注册 ─────────────────────────────────────────

/**
 * 注册一个可滚动边界区域
 *
 * scrollBoundary Action 在挂载时调用，在销毁时通过返回的函数取消注册。
 * Arena 在 tryAcquire 的边界让渡检查中查询这些区域。
 *
 * @param node - 可滚动的 DOM 节点
 * @param entry - 边界查询接口
 * @returns 取消注册函数
 */
export function registerScrollBoundary(node: HTMLElement, entry: ScrollBoundaryEntry): () => void {
	scrollBoundaries.set(node, entry);
	return () => {
		scrollBoundaries.delete(node);
	};
}

// ─── AnimationGuard ──────────────────────────────────────────────

/**
 * 注册手势后衔接动画
 *
 * 调用后，arena 进入动画保护状态：
 * - 可打断 (interruptible: true)：同类型手势的 tryAcquire 会 cancel 此动画后通过
 * - 不可打断 (interruptible: false)：所有 tryAcquire 都返回 false
 *
 * 动画自然完成（finished resolve）时自动清理。
 *
 * @param token - 动画令牌
 */
export function startAnimation(token: AnimationToken): void {
	animationState = token;

	// 动画结束后自动清理（只清理自己，防止清理到后来者的 token）
	// 使用 .then(cleanup, cleanup) 确保 resolve 和 reject 都会清理，
	// 防止 onEnd async 函数抛错导致 animationState 永远泄漏 → arena 死锁
	const cleanup = () => {
		if (animationState === token) {
			animationState = null;
		}
	};
	token.finished.then(cleanup, cleanup);
}

/**
 * 手动结束动画保护
 *
 * 通常不需要调用（startAnimation 会自动在 finished 后清理），
 * 但某些场景（如刷新完成后手动回弹）可显式调用。
 *
 * @param owner - 手势类型标识，只有匹配的动画才会被清理
 */
export function endAnimation(owner: string): void {
	if (animationState?.owner === owner) {
		animationState = null;
	}
}
