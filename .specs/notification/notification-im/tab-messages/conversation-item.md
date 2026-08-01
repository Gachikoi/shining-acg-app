# `notification.tab.messages.conversation-item` — 会话项

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 展示头像、昵称、摘要、时间、在线绿点、未读红点、静音与选中态。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 左 | 头像 + 在线点 | 圆形头像 |
| 中 | 昵称 + 摘要 | 摘要单行截断 |
| 右 | 时间 + 静音图标 + 未读点 | 垂直对齐 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 行容器 | `flex min-h-14 items-center gap-3 px-3 py-2`；选中 `bg-zinc-100 dark:bg-zinc-900`；hover `hover:bg-zinc-50 dark:hover:bg-zinc-900/60` |
| 头像 | `size-12 rounded-full bg-zinc-900 object-cover` |
| 在线点 | `absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950` |
| 昵称 | `text-sm font-semibold text-zinc-900 dark:text-zinc-50` |
| 摘要 | `truncate text-sm text-zinc-500` |
| 时间 | `text-xs text-zinc-400` |
| 未读点 | `size-2 rounded-full bg-red-500`；须有 sr-only「未读」 |
| 静音 | lucide `BellOff`，`text-zinc-400` |
| 触控 | 整行 ≥ `min-h-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键单击 | — | 选中会话 | `onSelectConversation(conversationId)` |
| 右键 | 桌面 | 打开会话菜单 | `onOpenConversationMenu(conversationId, anchor)` |
| 横向侧滑 | 触屏 | 露出操作栏 | `onRevealConversationActions(conversationId)` |
| Enter / Space | 聚焦时 | 同左键 | 同上 |

### 状态

- `selected` / `unread` / `muted` / `online` / `pinned`

### 边界

- 无头像用占位；摘要为空显示「」或「暂无消息」；在线/未读不可仅靠颜色。

### 本期不做

- 真实在线状态（可用 Mock 字段）。

### 组件验收

- [ ] 选中/未读/静音/在线视觉与可访问文本齐全
- [ ] 单击触发 `onSelectConversation`
- [ ] 右键/侧滑可打开菜单入口
