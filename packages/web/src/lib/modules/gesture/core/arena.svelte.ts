/**
 * @file GestureArena — 手势竞技场单例
 * @description
 * 灵感来自 Flutter 的手势竞技场，适配 Web DOM 事件冒泡模型。
 *
 * 核心职责：
 * 1. **竞态裁决**：多个手势识别器同时竞争时，通过 tryAcquire 仲裁谁有资格处理。
 * 2. **同轴滚动让渡**：同轴冲突时，子区域还能在当前方向滚动就让子处理，到边界才让渡给父。
 * 3. **动画保护 (AnimationGuard)**：手势后衔接的 Spring 动画有可打断/不可打断两种模式，
 *    在动画播放期间协调新手势的准入。
 *
 * 所有状态为模块级单例，使用 Svelte 5 runes 实现响应式。
 */

import type { EdgeZoneOptions } from '../actions/registry/edge-zone/types';
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
 * 正在播放的手势后动画集合
 * key 为手势实例 ID，value 为动画令牌
 * 每个手势实例的动画相互隔离：只有同一实例的新手势才能打断自身的动画
 */
const activeAnimations = new Map<string, AnimationToken>();

/**
 * 已注册的可滚动边界区域
 * key 为 DOM 节点，value 为边界查询接口
 */
const scrollBoundaries = new Map<HTMLElement, ScrollBoundaryEntry>();

/**
 * 已注册的边缘优先区域
 * key 为 DOM 节点（如 stack-item），value 为边缘区域配置
 * 当子级手势在父级边缘区触摸时，子级被拒绝，父级可优先获得控制权
 */
const edgeZones = new Map<HTMLElement, EdgeZoneOptions>();

/**
 * 指针起点是否落在 edgeZone 声明的四边条带内（只检测与当前手势主轴相关的边）。
 *
 * @param rect - `edgeNode.getBoundingClientRect()`
 * @param opts - 四边向内宽度（未设或 0 表示该边不参与）
 * @param params - 竞技场申请参数（用 axis + startX/startY）
 * @returns 是否命中边缘条带
 */
function isPointerInEdgeInsets(
	rect: DOMRect,
	opts: EdgeZoneOptions,
	params: AcquireParams
): boolean {
	const left = opts.left ?? 0;
	const right = opts.right ?? 0;
	const top = opts.top ?? 0;
	const bottom = opts.bottom ?? 0;

	if (params.axis === 'x' && params.startX !== undefined) {
		const x = params.startX;
		const inLeft = left > 0 && x >= rect.left && x <= rect.left + left;
		const inRight = right > 0 && x >= rect.right - right && x <= rect.right;
		console.log('left', inLeft, x, rect.left, rect.left + left);
		console.log('right', inRight, x, rect.right - right, rect.right);
		return inLeft || inRight;
	}

	if (params.axis === 'y' && params.startY !== undefined) {
		const y = params.startY;
		const inTop = top > 0 && y >= rect.top && y <= rect.top + top;
		const inBottom = bottom > 0 && y >= rect.bottom - bottom && y <= rect.bottom;
		console.log('top', inTop, y, rect.top, rect.top + top);
		console.log('bottom', inBottom, y, rect.bottom - bottom, rect.bottom);
		return inTop || inBottom;
	}

	return false;
}

// ─── 公共 API ────────────────────────────────────────────────────

/**
 * 手势识别器尝试获取竞技场控制权
 *
 * 裁决流程（按顺序）：
 * 1. **动画保护检查（实例级隔离）**：仅检查 params.id 自身是否有正在播放的动画，
 *    其他实例的动画不影响当前请求。
 *    - 自身有不可打断动画 → reject
 *    - 自身有可打断动画 → cancel 后继续
 *    - 自身无动画 → 继续
 * 2. **重复持有检查**：已被同 ID 持有 → grant（幂等）
 * 3. **互斥检查**：已被其他 ID 持有 → reject
 * 4. **边缘区域检查**：若当前手势的 node 是某 edgeZone 的子节点，且起点落在该 zone 在
 *    当前主轴上声明的边条带内（水平看 left/right，垂直看 top/bottom），
 *    → reject（让父级优先，父级稍后 tryAcquire 时会获得）
 * 5. **同轴滚动让渡检查**：在请求的轴+方向上，pointer 落在已登记的 scrollBoundary 内时，
 *    根据「手势 node」与「boundary node」的 DOM 关系查询 canScroll：
 *    - 边界为手势的**后代**（父手势包着子滚动区）：子还能滚 → reject 父；
 *    - 边界与手势**同一节点**：自身不能滚 → reject 自身（让外层）；
 *    - 边界为手势的**祖先**（如 viewport 登记边界、swipe 绑在内层容器）：自身不能滚 → reject 自身（让外层）。
 * 6. 以上全部通过 → grant
 *
 * @param params - 申请参数
 * @returns true 表示获得控制权（grant），false 表示被拒绝（reject）
 */
export function tryAcquire(params: AcquireParams): boolean {
	// 1. AnimationGuard（实例级隔离：仅检查自身的动画）
	const ownAnimation = activeAnimations.get(params.id);
	if (ownAnimation) {
		if (!ownAnimation.interruptible) {
			return false;
		}
		// 动画可打断 === 允许新手势接管，具体接管细节由业务方负责
		activeAnimations.delete(params.id);
	}

	// 2. 幂等：已由同一识别器持有
	if (activeGesture && activeGesture.id === params.id) {
		return true;
	}

	// 3. 互斥：已被其他识别器持有
	if (activeGesture && activeGesture.id !== params.id) {
		return false;
	}

	let hasEdgePrivilege = false;

	// 4. 边缘区域检查：子手势在父级边缘区触摸时被拒绝，或者父手势获得特权
	for (const [edgeNode, edgeOpts] of edgeZones) {
		// pointerTarget 必须在 edgeZone 内（触摸发生在该区域内）
		if (!edgeNode.contains(params.pointerTarget)) continue;

		const rect = edgeNode.getBoundingClientRect();
		const inEdge = isPointerInEdgeInsets(rect, edgeOpts, params);

		if (inEdge) {
			if (edgeNode.contains(params.node) && params.node !== edgeNode) {
				// 当前手势是 edgeZone 的严格子节点，且在边缘区触摸 -> 子手势被拒绝，让父级优先
				return false;
			} else if (params.node === edgeNode) {
				// 当前手势是 edgeZone 本身 -> 获得边缘特权，后续跳过子级的边界让渡拦截
				hasEdgePrivilege = true;
			}
		}
	}

	// 5. 同轴滚动让渡：检查相关可滚动区域
	for (const [boundaryNode, entry] of scrollBoundaries) {
		const isSelf = params.node === boundaryNode;
		const isStrictChild = params.node.contains(boundaryNode) && !isSelf;
		const containsPointer = boundaryNode.contains(params.pointerTarget);

		if (containsPointer) {
			const canScroll = entry.canScroll(params.axis, params.direction);

			if (isStrictChild) {
				// 子级区域：如果子级还能滚动，且父级没有边缘特权，才拒绝当前（父级）手势
				if (canScroll && !hasEdgePrivilege) {
					return false;
				}
			} else if (isSelf) {
				// 自身区域：到边界时仅“滚动类手势”需要让渡给外层。
				// 像 tap/long-press 这类离散手势不应被 scrollBoundary 阻断
				const shouldYieldOnBoundary = params.type === 'swipe' || params.type === 'pull-refresh';
				if (shouldYieldOnBoundary && !canScroll) return false;
			}
		}
	}

	// 6. Grant
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
	for (const token of activeAnimations.values()) {
		if (!token.interruptible) return false;
	}
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

// ─── EdgeZone 注册 ───────────────────────────────────────────────

/**
 * 注册边缘优先区域
 *
 * 用于 stack pop 等父级手势：当子级同轴手势（如 SwipeablePane）在父级声明的左/右或上/下
 * 条带内触摸时，子级 tryAcquire 会被拒绝，父级可优先获得控制权。
 *
 * @param node - 边缘区域所属的 DOM 节点（如 stack-item）
 * @param options - 四边向内条带宽度（px）；水平手势看 left/right，垂直手势看 top/bottom
 * @returns 取消注册函数
 */
export function registerEdgeZone(node: HTMLElement, options: EdgeZoneOptions): () => void {
	edgeZones.set(node, options);
	return () => {
		edgeZones.delete(node);
	};
}

// ─── AnimationGuard ──────────────────────────────────────────────

/**
 * 注册手势后衔接动画
 *
 * 以 token.id 为 key 存入 activeAnimations Map。
 * 同一手势实例的新 tryAcquire 会检查自身的动画：
 * - 可打断 → cancel 后放行
 * - 不可打断 → 拒绝新手势
 *
 * 动画自然完成（finished resolve）时自动从 Map 中移除。
 *
 * @param token - 动画令牌（必须包含 id 字段）
 */
export function startAnimation(token: AnimationToken): void {
	activeAnimations.set(token.id, token);

	// 动画结束后自动清理（只清理自己，防止清理到后来者的 token）
	const cleanup = () => {
		if (activeAnimations.get(token.id) === token) {
			activeAnimations.delete(token.id);
		}
	};
	token.finished.then(cleanup, cleanup);
}

/**
 * 手动结束指定手势实例的动画保护
 *
 * 通常不需要调用（startAnimation 会自动在 finished 后清理），
 * 但某些场景（如刷新完成后手动回弹）可显式调用。
 *
 * @param id - 手势实例 ID
 */
export function endAnimation(id: string): void {
	activeAnimations.delete(id);
}
