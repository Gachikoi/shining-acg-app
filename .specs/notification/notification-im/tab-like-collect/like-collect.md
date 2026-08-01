# `notification.tab.like-collect` — 赞和收藏 Tab 编排

- **设计源**: [`.design/notification/like/image.png`](../../../../.design/notification/like/image.png)
- **父节点**: `notification.tab.like-collect`
- **职责**: 列表与已读编排。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 列表 | item | |
| 状态 | empty/loading/error | shared |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 面板 | `h-full overflow-y-auto`；`id="notification-panel-like-collect"` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | Tab 激活 | 本地已读 | `onTabMarkedRead('like-collect')` |

### 状态

- `items` / `loading` / `error`

### 边界

- 同评论 Tab。

### 本期不做

- 目标跳转。

### 组件验收

- [ ] 打开 Tab 本地已读
- [ ] 状态反馈齐全
