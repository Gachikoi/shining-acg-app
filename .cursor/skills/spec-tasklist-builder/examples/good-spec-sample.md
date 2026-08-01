# 优质 Spec 样例（渐进披露 · 方案 C · 虚构缩小版）

> 用途：写 Spec 前校准质量上界。真实业务按设计源展开，勿照抄虚构细节。

## 目录形态

```text
.specs/home/home-feed.spec.md
.specs/home/home-feed/
  tab-main/
    _index.md
    filter.md                    # 扁平：直接挂在 area-dir
    card-grid.md
    card/                        # 二级嵌套：module = 子组件目录
      card.md
      media.md
      actions.md
```

## 主文件（节选）

```markdown
# 需求Spec：首页 Feed 开发

> 渐进披露入口。先读本文件选 task，再只打开该行 spec（双层：分析 → 实现契约）。

## 目标描述
登录用户在 App 首页浏览综合信息流。

## 技术约束
- UI：分析层自然语言方块；实现映射项目约定；契约 class 仅参考（非强制）
- 交互：分析层意图→回调；契约层事件表+回调
- 详述目录：.specs/home/home-feed/
- 进度真相源：本文件「任务与进度」

## 功能需求索引
- [Tab · 综合](home-feed/tab-main/_index.md) — `home.tab.main`

## 任务与进度

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `home.tab.main.filter` | 筛选面板 | todo | `.design/home/...` | [`filter.md`](home-feed/tab-main/filter.md) | [] | |
| `home.tab.main.card` | 信息卡片 | todo | `.design/home/...` | [`card.md`](home-feed/tab-main/card/card.md) | [] | |
| `home.tab.main.card.media` | 卡片媒体 | todo | `.design/home/...` | [`media.md`](home-feed/tab-main/card/media.md) | [] | |
| `home.tab.main.card.actions` | 卡片操作 | todo | `.design/home/...` | [`actions.md`](home-feed/tab-main/card/actions.md) | [] | |
```

## 子需求 `_index.md`（节选）

```markdown
# Tab · 综合
- **id**: `home.tab.main`
- **职责**: 默认信息流；编排筛选与卡片区
- **子组件**:
  - [`home.tab.main.filter`](filter.md) — 筛选面板
  - [`home.tab.main.card`](card/card.md) — 信息卡片
- **编排交互**:
  1. `onFiltersChange` → 卡片区刷新
  2. `onOpenPost` → 打开详情
```

## 组件详述（节选 · 双层）

```markdown
# `home.tab.main.card` — 信息卡片

- **父节点**: `home.tab.main`
- **子组件** (`children`):
  - [`home.tab.main.card.media`](media.md) — 卡片媒体
  - [`home.tab.main.card.actions`](actions.md) — 卡片操作
- **职责**: 单条 Feed 卡片容器

## 分析

### 目标
在信息流中展示一条内容的摘要入口。

### 模块（方块）

#### 媒体区
- **内容**: 封面图或占位（可挂 media 子组件）
- **样子**: 大圆角矩形；无图时中性底 + 弱提示；窄屏仍通栏，不缩成侧栏小图

#### 文案区
- **内容**: 标题 + 一行摘要
- **样子**: 标题主层级、略重；摘要次要色、单行省略；间距舒适不紧贴

#### 操作区
- **内容**: 点赞 / 更多（可挂 actions 子组件）
- **样子**: 弱图标按钮；触控足够大；不抢标题注意力
- **局部意图**: 点更多 → 打开操作菜单

### 整体交互意图
- 点非操作区 → `onOpenPost(id)`
- 点更多 → `onOpenActions(id, anchor)`

### 本期不做 / 待澄清（分析）
- 真实点赞计数同步

## 实现契约

### 状态
- 无本地编辑态；选中/按下由父级或 CSS 处理即可

### 边界
- 无封面走占位；标题为空显示「无标题」

### 交互

| 手势/键 | 条件 | 行为 | 回调 |
|---------|------|------|------|
| 左键单击非操作区 | — | 打开详情 | `onOpenPost(id)` |
| 左键单击更多 | — | 打开操作 | `onOpenActions(id, anchor)` |

### 输入约束
- 触控可点区域 ≥ 44×44

### 可选参考实现
- 参考（非强制）：容器可用纵向 flex、区块间距一档

### 本期不做（实现）
- 真实点赞 API

### 组件验收
- [ ] 三区块层次符合分析描述
- [ ] 非操作区点击触发 `onOpenPost`
- [ ] 组合 media + actions 子组件
```

**✅ 好在哪里**

1. 主文件短，进度一眼可见；`spec` 指向单文件双层详述。
2. 「分析」先拆方块与样子；「实现契约」再给事件表与验收。
3. 样子用自然语言，不把 Tailwind 当 Spec 真相源。
4. 实现只加载一个组件文件；需要子件时按 `children` 下钻。
