# Svelte 5 手势系统架构 (Gesture Arena)

本模块实现了一套高可靠、可打断的 Svelte 5 手势处理机制。灵感来源于 Flutter 的
Gesture Arena，用于解决复杂的嵌套手势冲突（如：`SwipeablePane` 与 `StackItem`
的横向滑动冲突、`PullRefresh` 与滚动容器的纵向冲突）。

## 核心设计理念

1. **统一仲裁 (Arena)**：所有手势在被正式确认前，都必须向 `GestureArena`
   申请控制权 (`tryAcquire`)。
2. **边缘优先 (Edge Zone)**：支持屏幕边缘手势优先（例如全局右滑返回）。
3. **边界让渡 (Scroll
   Boundary)**：支持在子容器滚动到边界时，将手势控制权平滑过渡给外层父容器。
4. **动画保护 (Animation Guard)**：手势结束后的 Spring
   物理动画受到保护，打断策略可配。

## 模块结构

业务代码请**只**从 [`index.ts`](./index.ts)（即
`$lib/modules/gesture`）导入。子路径可能随重构变化。

本仓库内所有 `use:…` 实现均位于 `actions/`；其中 **`registry`** 与
**`gestures`** 都是 Svelte Action，区别仅在于职责：

| 目录                | 职责                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `actions/registry/` | 登记型：在挂载时向竞技场 `register*`，为 `tryAcquire` 提供边缘几何或滚动边界查询（`edge-zone`、`scroll-boundary`）。        |
| `actions/gestures/` | 交互闭环型：监听 pointer/wheel，完成 `tryAcquire` → 跟踪 → `release`/动画（`swipe`、`pull-refresh`、`long-press`、`tap`）。 |

- `core/arena.svelte.ts`：竞技场单例，竞态裁决（互斥、边缘优先、边界让渡、动画保护）。
- `core/types.ts`、`core/utils.ts`：共享类型与工具函数。
- `actions/registry/edge-zone/`：`use:edgeZone`。
- `actions/registry/scroll-boundary/`：`use:scrollBoundary`。
- `actions/gestures/swipe/`：`use:swipe`（Pointer + Wheel）。
- `actions/gestures/pull-refresh/`：`use:pullRefresh`（含 Safari
  橡皮筋相关处理）。
- `actions/gestures/long-press/`、`actions/gestures/tap/`：对应 Action。

## 冲突解决机制详解

当一个手势（如 `swipe`）开始尝试获取控制权时，竞技场 (`tryAcquire`)
会按照以下严格顺序进行裁决：

### 1. 动画保护检查 (Animation Guard)

如果当前竞技场内有正在执行的不可打断动画，拒绝新的手势。如果可打断且类型相同，则打断旧动画并放行。

### 2. 重复持有与互斥检查

- 如果该手势已经持有控制权，直接放行（幂等）。
- 如果别的识别器正持有控制权，拒绝当前手势（互斥）。

### 3. 边缘区域优先检查 (Edge Zone)

**使用场景**：`StackItem` 的屏幕边缘右滑退出 (Pop)。 **规则**：

- 通过 `use:edgeZone={{ left: 24 }}` 注册边缘区域。
- 当子手势（如 `SwipeablePane` 的内部切换）在父级的左右 24px
  边缘区域内触发时，**子手势会被竞技场拒绝**。
- 子手势被拒绝后，由于用户的手指还在滑动，冒泡上来的事件会被父手势（`StackItem`）捕获，父手势因为拥有
  `hasEdgePrivilege` 特权，从而成功接管控制权。

### 4. 边界让渡检查 (Scroll Boundary)

**使用场景**：`SwipeablePane` 在第一页继续右滑时，触发外层 `StackItem` 的退出。
**规则**：

- 内部可滚动区域（如 `SwipeablePane` 容器或普通的 `overflow-auto` 容器）通过
  `use:scrollBoundary={{ axis: 'x', canScroll: ... }}` 注册。
- `canScroll` 会根据当前方向动态返回 `true/false`。
- 如果内部区域还能滚动（`canScroll === true`），竞技场会拒绝外层父级手势，把手势留给子元素。
- 如果内部区域已经滚动到边界（`canScroll === false`），竞技场会拒绝子元素的手势，并放行外层父级手势。

## 开发规范与注意事项

1. **增加新手势**：
   - 必须调用 `tryAcquire` 并在获准后再执行 `preventDefault`；
   - 尽量不用
     `setPointerCapture`，它会与浏览器默认的隐式指针捕获行为发生冲突，除非你明确知道你需要的客制化行为；
   - 一定要保证手势从开始检测到 `tryAcquire`
     过程中全为同步代码。此手势系统依赖事件冒泡的同步执行来确保事件由子元素先处理后再由父元素处理，由此保证子元素上手势的优先级大于父元素。如果在
     `tryAcquire` 之前事件处理函数中存在异步代码，则会打乱这种优先级。
2. **Safari 兼容**：在 `pending`（方向未决）阶段，通过精确计算 `dx` 和 `dy`
   动态决定是否 `e.preventDefault()` 以规避 Safari
   移动端自带的橡皮筋拦截，不能无脑 preventDefault。
3. **指针补救 (Auto
   Recovery)**：如果手势在一开始被判定为无效方向释放了指针，但用户未松手且改变了方向，`onPointerMove`
   中的 `autoRecovery` 逻辑会重新发起手势追踪。
