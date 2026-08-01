# `profile.content.grid` — 内容网格

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.content`
- **子组件** (`children`):
  - [`profile.content.post-card`](post-card.md) — 内容卡片
- **职责**: 按当前 Tab 以多列网格展示内容卡片列表。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 网格 | CSS grid | 桌面约 4 列；窄屏 2 列 |
| 项 | `post-card` | 重复渲染 |
| 空态 | 文案 | 无数据时 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4` |
| 空态 | `py-16 text-center text-sm text-zinc-400` |
| 触控 | 由卡片承担 |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | — | 列表容器；点击在卡片 | 透传 `onOpenPost` / `onToggleLike` |

### 状态

- props：`items: PostCardModel[]`、`activeTab`
- 加载中可用简单文案「加载中…」（可选）

### 边界

- **本期**：忽略主人鉴权，始终可渲染传入的 `items`（可为 Mock）。  
  在装配 `items` 处保留与 tabs 相同的 TODO 注释。
- 横向不溢出；图片比例由卡片约束。

### 本期不做

- 无限滚动 / 分页 API。
- 鉴权后的锁定空态 UI（仅 TODO）。

### 组件验收

- [ ] ≥2 列响应式网格；有 Mock 数据时卡片铺满
- [ ] 空列表显示空态文案
- [ ] 通过 `children` 使用 `post-card`
