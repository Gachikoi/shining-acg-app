# reorder-grid — 自研 Wrap Grid 拖拽排序

本目录实现「**flex-wrap 等效网格**」上的指针拖拽排序：用 **纯函数布局** + **`transform: translate`** + **中间层 `slotOrder`**，不依赖 SortableJS，便于与 Svelte 5 状态、移动端触摸和长列表共存。

---

## 研发思路

### 为何自研

- **沟槽的文档流**：已经试验过了 SortableJS 和 Interact.js ，均存在残影生命周期异常和排序混乱的问题，在和沟槽的文档流缠斗8小时之后，选择拥抱 `relative`容器+`absolute`拖动项+`transform`手动定位排序。
- **DOM 与数据一致**：排序过程中不依赖「拖完再读 DOM 顺序」；放手时用明确的 `(fromIndex, toIndex)` 回写业务数据，`{#each}` 继续以稳定 key（如对象引用）驱动列表。
- **移动端可控**：触摸长按延迟、与页面纵向滚动的取舍、`pointercancel` 等可在同一套状态机里收口；不必和第三方库的黑盒行为搏斗。
- **布局可预测**：网格等价于固定 `cell` 尺寸与 `gap`，列数由容器宽度算出，与常用的 `flex flex-wrap gap-*` 视觉对齐。

### 核心模型：槽位排列 `slotOrder`

- 业务数组 `items` 的下标称为 **源下标**（`0 … n-1`），在拖拽过程中**不变**。
- 视觉上从左到右、从上到下的一排「格子」叫 **槽位**；`slotOrder` 是一个长度 `n` 的排列：
  `slotOrder[slot] === itemIndex` 表示：**第 `slot` 个格子里画的是 `items[itemIndex]`**。
- **恒等状态**：`[0,1,…,n-1]` 表示顺序与 `items` 一致。
- **拖拽中**：根据指针落在哪个槽位附近，对 `slotOrder` 做「抽出再插入」的更新（`moveSlotOrder`），其它格子的 `translate` 跟着变，但 **不** 提前改 `items`。
- **放手**：若 `slotOrder` 相对恒等排列有变化，则用 `toIndexForReorder(slotOrder, fromIndex)` 得到目标 **源下标** `toIndex`，调用 `onReorder(fromIndex, toIndex)`，由外层一次 `splice` 或等价逻辑更新 `items`。

这样 **`items` 与 `slotOrder` 职责分离**：动画帧只动 `slotOrder` + `transform`，提交只动数据。

### 布局层（`wrap-grid.ts`）

纯函数，无 DOM：

| 能力                                    | 说明                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| `wrapGridColumnCount`                   | 由容器宽、`cell` 宽、`gap` 算列数，与 flex-wrap 折行规则一致 |
| `wrapGridCellPosition`                  | 槽位索引 → `(x, y)` 像素偏移                                 |
| `wrapGridSlotFromPoint`                 | 容器内 `(dx, dy)` → 落在哪一格                               |
| `wrapGridHeightPx` / `wrapGridRowCount` | 算整网高度，供外层 `min-height` 撑开滚动                     |

`ReorderGrid` 用 `ResizeObserver` + 探测子格尺寸得到 `cellW/cellH/gap`，把快照交给 `createWrapGridDragSort` 的 `getLayout()`。快照里的 **`contentWidthPx`** 与 RO 的 `contentRect.width` 一致，**列数计算与槽位命中**（`wrapGridColumnCount` / `wrapGridSlotFromPoint`）都使用它，避免与 `getBoundingClientRect().width`（边框、滚动条等）混用导致「预览格子列数」和「指针落下判槽」不一致。

状态机在计算**指针相对容器的位移**（`dragX`/`dragY`）时仍使用 `getBoundingClientRect()`，仅列宽维度与渲染侧对齐。

### 拖拽表现：跟手

被拖项**不要**用「槽位 `translate` + 相对按下点的 `delta`」叠加：因为 `slotOrder` 一变，槽位基底会跳，`delta` 仍相对最初按下点，视觉上会**脱离手指**.

当前做法：

1. 进入拖拽时，用 **最近一次指针位置**（`lastClient`，兼容长按延迟期间指尖微移）相对**起始格左上角**计算 **抓取偏移** `grabOffset`。
2. 移动中：`dragX/Y = 指针在容器内的坐标 - grabOffset`，每帧用 `containerEl.getBoundingClientRect()` 换算，保证**卡片始终贴在手指下**。
3. 模板里：**仅被拖项**用 `translate(dragX, dragY)`；其它项仍用 `translate(pos.x, pos.y)`（由当前 `slotOrder` 推导 `pos`）。

### 指针与触摸（`wrap-grid-drag-sort.svelte.ts`）

- **`bindCellListeners`**：`pointerdown` 使用 `{ capture: true, passive: false }`；在 `window` 上对 **`pointermove` / `pointerup` / `pointercancel`（capture）** 分两种阶段挂载：
  - **pending**：已按下、尚在长按延迟或未进拖拽；
  - **dragging**：已进入排序拖拽。
- 触摸下子元素、外层 `overflow-y-auto` 常会「吃掉」元素上的 move，`window` 兜底可避免丢帧。
- **延迟**：默认 `delay`（如 450ms）且 `delayOnTouchOnly === true` 时，仅触摸/笔走延迟，鼠标可立即拖或按阈值为无延迟路径。
- **鼠标在延迟阶段小幅移动**：超过约 8px 会取消排序等待（减少「想点击却进拖拽」）；触摸/笔不因微抖取消。
- **与页面纵向滚动共存**：
  - 默认格子上 `touch-pan-y`，便于从缩略图上滑页；
  - 约 **80ms** 后对本格做 `touch-none`（及子代），并在 delay 后半段对 **`pointermove` / `touchmove`（`passive: false`）`preventDefault`**，避免「长按后要排序却变成整页滚动」（尤其 WebKit）。

### 组件与工厂分工

| 载体                         | 职责                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| **`ReorderGrid`**            | 声明式：`items`、`item` / `footer` snippet、测量布局、渲染 `transform`、内置 `createWrapGridDragSort` |
| **`createWrapGridDragSort`** | 可复用的状态机：若自有布局 UI，可只接工厂 + `bindCellListeners`                                       |

---

## 使用方法

### 推荐：`<ReorderGrid>`

```svelte
<script lang="ts">
	import { ReorderGrid } from '$lib/modules/reorder-grid';

	let items = $state<MyItem[]>([...]);

	function handleReorder(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		const next = items.slice();
		const [one] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, one!);
		items = next;
	}
</script>

<ReorderGrid
	class="gap-2"
	{items}
	itemCellClass="h-24 w-24 shrink-0"
	delay={450}
	delayOnTouchOnly={true}
	disabled={false}
	onReorder={handleReorder}
	onReorderError={(err) => {
		/* 可选：`onReorder` 抛错时调用；此时不会触发 onDragEnd */
		console.error(err);
	}}
	onDragStart={(i) => {
		/* 可选：高亮、震动、haptics */
	}}
	onDragEnd={() => {
		/* 可选：清理高亮；排序成功或取消拖拽后调用（失败见 onReorderError） */
	}}
>
	{#snippet item(item, index)}
		<!-- 外层已由组件加上 absolute + translate；这里写卡片内容 -->
		<div class="h-full w-full rounded-lg bg-muted">
			{item.title}
		</div>
	{/snippet}
</ReorderGrid>
```

**可选 `footer`**：占据网格末尾一格（例如「+ 添加」）。**参与** `wrapGridSlotFromPoint` 的 `totalSlots`（影响最后一列占位与指针划过 footer 区域时的槽位预测），但 **`onReorder` 只会收到 `items` 内部的下标**，永远不会把 footer 当作拖拽源或提交目标下标。参考 `release-media-picker.svelte`。

**`onReorder` / `onDragEnd` / `onReorderError`**

- 放手后若顺序相对拖拽前**有变化**，会先调用 `onReorder(from, to)`；**成功**后再调 `onDragEnd`。
- 若 `onReorder` **抛出异常**，会打控制台日志、调用可选的 **`onReorderError(error)`**，且**不会**调用 `onDragEnd`；此时 UI 仍会回到 idle，**`items` 是否已部分修改由你的 `onReorder` 保证**（建议内部事务化或自行回滚）。
- 无位移或顺序与原来相同：只调 `onDragEnd`（不调用 `onReorder`）。

**`disabled`**

- 在 **pending**（长按等待）或 **dragging** 过程中若变为 `true`，会通过内部 `$effect` **取消拖拽**（若在 dragging 会先 `onDragEnd`）。

**注意**

- **`{#each}` 的 key**：请使用稳定引用（如 `item` 对象），不要用排序会变的下标当唯一 key。
- **卡片内触摸**：由外层格统一 `touch-action`；内层尽量不要再写冲突的 `touch-pan-y` / `touch-none`，除非你有意覆盖。

### 边界与排错

| 现象                           | 可能原因                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 指针指着 A 格却插入到 B 列     | 自定义 `getLayout()` 时勿用 `getBoundingClientRect().width` 算列数；应与 **`contentWidthPx`**（内容区宽度）一致。 |
| `onDragEnd` 没跑但以为排序失败 | 查看是否在 `onReorder` 里抛错；失败路径走 **`onReorderError`**，不触发 `onDragEnd`。                              |
| 禁用后仍能拖一下               | 确认 `disabled` 为 Svelte 可追踪状态；状态机依赖对 `isDisabled()` 的订阅。                                        |

### 进阶：只用 `createWrapGridDragSort`

适合自定义网格 DOM、但仍想用同一套 `slotOrder` / 指针逻辑：

1. 实现 `WrapGridDragSortFactoryOptions`：`getItemCount`、`getLayout`（`WrapGridLayoutSnapshot | null`，须含 **`contentWidthPx`**）、`isDisabled`、`onReorder` 等。
2. `const sort = createWrapGridDragSort({ ... })`。
3. 在每个可拖单元根节点调用 `sort.bindCellListeners(el, sourceIndex)`，并在 teardown 时执行返回的函数。
4. 渲染时用 `sort.phase`、`sort.slotOrder`、`sort.dragX/dragY`、`sort.activeSourceIndex` 等与当前 `wrap-grid` 布局公式拼 `transform`。

### 可从 `index.ts` 导入的工具函数

便于单测、Storybook 或自定义 UI 复用布局与 `slotOrder` 运算：

- `identitySlotOrder`, `moveSlotOrder`, `toIndexForReorder`, `slotOrdersEqual`
- `wrapGridCellPosition`, `wrapGridColumnCount`, `wrapGridRowCount`, `wrapGridHeightPx`, `wrapGridSlotFromPoint`

---

## 文件一览

| 文件                            | 说明                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `types.ts`                      | `ReorderGridProps`、`WrapGridDragSort`、`WrapGridDragSortFactoryOptions`、布局快照类型 |
| `wrap-grid.ts`                  | 网格几何与 `slotOrder` 纯函数                                                          |
| `wrap-grid-drag-sort.svelte.ts` | 拖拽状态机 + `bindCellListeners`                                                       |
| `reorder-grid.svelte`           | 通用网格组件                                                                           |
| `index.ts`                      | 对外导出                                                                               |

---

## 参考接入

项目内完整示例：`src/routes/app/release/components/release-media-picker.svelte`（媒体缩略图网格 + `footer` + `onReorder` 写回 editor）。
