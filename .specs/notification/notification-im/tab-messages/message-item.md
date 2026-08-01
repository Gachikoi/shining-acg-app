# `notification.tab.messages.message-item` — 消息项

- **设计源**: [`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 文本/图片占位/引用摘要与发送状态；能力字段控制撤回/编辑可用性。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 气泡 | 文本 / 图片占位 / 引用条 | |
| 元信息 | 时间 / 发送状态 | |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 行·对方 | `flex justify-start` |
| 行·自己 | `flex justify-end` |
| 气泡·对方 | `max-w-[75%] rounded-2xl border border-zinc-100 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50` |
| 气泡·自己 | `max-w-[75%] rounded-2xl bg-red-50 px-3 py-2 text-sm text-zinc-900 dark:bg-red-950/40 dark:text-zinc-50` |
| 引用条 | `border-l-2 border-zinc-200 pl-2 text-xs text-zinc-500` |
| 图片占位 | `max-h-48 rounded-xl bg-zinc-200 dark:bg-zinc-800` |
| 时间 | `mt-1 text-[0.625rem] text-zinc-400` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 右键 | 桌面 | 打开消息菜单 | `onOpenMessageMenu(messageId, anchor)` |
| 长按 | 触屏 | 打开消息菜单 | `onOpenMessageMenu(messageId, anchor)` |

### 状态

- `status: 'sending' \| 'sent' \| 'failed'`；`capabilities: { recall, edit }`

### 边界

- 失败态可点重试（若做）→ `onRetrySend(messageId)`；无能力时菜单项禁用或隐藏。

### 本期不做

- 真实已读回执。

### 组件验收

- [ ] 自己消息右对齐且 `bg-red-50`（或 dark 等价）
- [ ] 右键/长按可打开菜单入口
