# SwipeablePane：虚拟三槽视窗

本文说明 `swipeable-pane` 目录下的数据模型、纯函数边界，以及手势 / 程序化跳转 / 外部同步的协作方式。实现以「始终最多挂载三个槽位 + WAAPI 驱动 `translate3d`」为核心，避免用额外枚举状态描述「是否在动画中」——**`containerElAnimation !== null` 即表示有一段 Web Animations 正在占用容器**。

---

## 一、职责一览

| 区域         | 文件 / 位置             | 作用                                                                                             |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------ |
| 组件与副作用 | `swipeable-pane.svelte` | 三槽 DOM、`swipe` 手势、`jumpToIndex` / `updatePanels`、ResizeObserver、`registerScrollBoundary` |
| 类型         | `types.ts`              | `CategoryOption`、`SwipeablePaneProps`                                                           |
| 纯逻辑       | `utils.ts`              | `buildPanels`、`inspectVisualState`（不读写 DOM、不碰手势模块）                                  |
| 对外导出     | `index.ts`              | 组件与类型再导出                                                                                 |

---

## 二、核心状态（与源码命名一致）

父组件通过 props 传入的 **`currentIndex` / `currentCategoryId`** 表示「逻辑上当前居中的是哪一页」。组件内部在此基础上维护：

| 状态                   | 含义                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `panels`               | 长度固定为 3 的元组；不需要渲染的槽位为 `null`，由 `buildPanels` 决定                |
| `capturedOffset`       | 本次手势（或 jump 对齐后）的基准偏移；`onMove` 中与 `deltaX` 叠加得到实时 offset     |
| `containerWidth`       | 视口宽度（来自父元素 `ResizeObserver`），同时作为单槽宽度与位移单位                  |
| `containerElAnimation` | 当前容器上的 `Animation`；非 `null` 表示有进行中的 WAAPI 动画                        |
| `activeTargetIndex`    | 当前这段过渡（手势 settle 或 `jumpToIndex`）要到达的目标真实索引；用于借位渲染目标页 |
| `queuedJumpTargets`    | 动画进行中再次 `jumpToIndex` 时排队的目标索引                                        |

**偏移约定**：容器总宽为 `300%`（三列各 `1/3`），`translate3d` 以「槽位 1 在视口居中」为归零点；`captureCurrentOffset()` 从 `getComputedStyle(containerEl).transform` 反算当前 offset，保证与 WAAPI 中间帧一致。

---

## 三、纯函数工具（`utils.ts`）

仅两个导出，对应两类无副作用演算：

### 1. `buildPanels(centerIndex, categories, offset, width, activeTargetIndex?)`

- 默认以 `centerIndex` 生成 `[prev, current, next]` 三槽数据。
- 若传入 `activeTargetIndex` 且与 `centerIndex` 不同，把**目标页**放到即将进入视口的一侧（左或右槽），实现非相邻 Tab 的「单步」动画所需的 DOM 借位。
- 再根据各槽在视口内的可见性及是否为活动目标，把不可见的槽置为 `null`，控制实际挂载子树数量。

### 2. `inspectVisualState(offset, panels, width, fallbackIndex)`

- 在给定 `offset` 下，从当前非空槽中找出**离视口水平中心最近**的面板（`primaryIndex` / `primarySlot`），以及次近项。
- 返回 `residualOffset`：把「当前视觉中心」重新对齐到槽位 `1` 时，容器应使用的偏移量。手势跨页时用它重写 `capturedOffset`，避免窗口与手指脱节。

**松手后的目标页**：在 `onEnd` 中根据 `inspectVisualState` 的结果，并结合 `SwipeState` 的速度阈值与方向，内联判定 `targetIndex`。

---

## 四、`animateTo(from, to, duration)`

组件内统一的 WAAPI 入口，签名为 `(from, to, duration)`；可拖动范围的钳位在调用方通过 `clampOffset(raw, baseIndex)` 完成：

1. 启动前先结束当前未完成的容器动画：`commitStyles` + `cancel`，并置 `containerElAnimation = null`。
2. 新建 `translate3d` 关键帧动画，写入 `containerElAnimation`。
3. 默认 `onfinish`：`commitStyles`、`cancel`，并在仍为当前实例时清空 `containerElAnimation`。

`duration === 0` 时用于「跟手拖动」或「瞬间归中」，逻辑路径相同；若业务上在别处覆写 `onfinish`，需自行保证最终与上述清理一致，否则会留下悬挂的动画引用。

---

## 五、手势流程（`swipe` 配置）

### `onStart`

- `resetTransitionState(true)`：结束当前动画、清空 `activeTargetIndex` 与 jump 队列。
- `capturedOffset = captureCurrentOffset()`：从真实 transform 接棒，支持打断动画后立即拖动。
- `animateTo(capturedOffset, capturedOffset, 0)`：把当前帧写回动画管线，避免 inline style 与 WAAPI 打架。

### `onMove`

- 用 `clampOffset(capturedOffset + deltaX, currentIndex)` 得到合法偏移。
- `inspectVisualState`：若 `primaryIndex !== currentIndex`，通过 `onIndexChange` 同步父级索引，并用 `residualOffset - deltaX` 更新 `capturedOffset`，使窗口与手指一致。
- `buildPanels(currentIndex, categories, offset, containerWidth)` 重建三槽，再 `animateTo(offset, offset, 0)` 实时跟手。

### `onEnd`

- 再次用 `inspectVisualState` 与速度条件确定 `targetIndex`（相邻页 + 速度方向，或与视觉中心已跨页一致）。
- 设置 `activeTargetIndex`、`buildPanels(..., targetIndex)`，必要时 `onIndexChange`。
- `animateTo(fromOffset, toOffset, ANIMATION_DURATION)`，`onfinish` 里调用 `finishAnimation(targetIndex)` 定稿。

---

## 六、`jumpToIndex` 与队列

- **空闲**：`startJumpTransition` —— `resetTransitionState(false)` 保留队列；用 `inspectVisualState` + `captureCurrentOffset` 对齐视觉基准；设 `activeTargetIndex` 与借位 `panels`；下一帧 `requestAnimationFrame` 里若目标仍有效且无其它动画抢占，则启动段动画，`onfinish` → `finishAnimation`。
- **动画中**：不覆盖当前段；若新目标与当前 `activeTargetIndex` 或队尾重复则忽略；否则 `queuedJumpTargets` 追加。
- **`finishAnimation`**：清空 `activeTargetIndex`、按目标索引 `buildPanels` 归中、`capturedOffset = 0`、`animateTo(0,0,0)`，将 `containerElAnimation` 置 `null`，再 `pumpJumpQueue()` 消费下一目标。

`requestAnimationFrame` 与「`activeTargetIndex` 被手势清空 / `containerElAnimation` 已被占用」共同防止过期 jump 误启动。

---

## 七、外部同步与宿主集成

1. **`$effect`（仅 categories）**：依赖 `categories`；在 `untrack` 中按 `currentCategoryId` 解析索引并调用 `updatePanels`，在列表项变更时尽量对齐到当前分类。
2. **`updatePanels(currentIndex)`**（导出）：`resetTransitionState(true)`、按新索引 `buildPanels(..., 0)`、`capturedOffset = 0`、`animateTo(0,0,0)` —— 用于路由 snapshot restore 等场景。
3. **ResizeObserver（父元素）**：更新 `containerWidth` 后调用 `animateTo(0,0,0)`，避免仅改 style 与动画状态不一致。
4. **`registerScrollBoundary`（父元素，轴 `x`）**：根据 `currentIndex` 与 `categories.length` 声明是否还能向内滑动，与全局手势竞技场协作。

---

## 八、刻意保留的响应式范围

项目约定尽量少用 `$effect`。此处 **仅** categories 同步使用 `$effect`；动画结束后的定稿与 jump 队列的泵送由 `onfinish` / `finishAnimation` 显式驱动。
