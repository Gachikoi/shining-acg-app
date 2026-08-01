# `notification.tab.comment-mention` — 评论和@ Tab 编排

- **设计源**: [`.design/notification/comment/image.png`](../../../../.design/notification/comment/image.png)
- **父节点**: `notification.tab.comment-mention`
- **职责**: 列表、已读与空/载/错态编排。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 列表 | item 集合 | 单列 |
| 状态 | empty/loading/error | shared |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 面板 | `h-full overflow-y-auto`；`id="notification-panel-comment-mention"` |
| 列表 | `divide-y divide-zinc-100 dark:divide-zinc-800` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | Tab 激活 | 本地已读 | `onTabMarkedRead('comment-mention')` |
| 重试 | 错误态 | 重新加载本地/适配层 | `onRetryLoad()` |

### 状态

- `items` / `loading` / `error`

### 边界

- 本期可先本地 Mock；可引用生成 SDK 但禁手改生成文件。

### 本期不做

- 目标帖子/评论路由跳转。

### 组件验收

- [ ] 打开 Tab 触发本地已读
- [ ] 空/载/错态可见
