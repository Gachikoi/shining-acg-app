# `notification.tab.messages.message-menu` — 消息操作浮窗

- **设计源**: [`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 复制、引用、撤回、编辑。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 浮窗 | 四项 | 复制 / 引用 / 撤回 / 编辑 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 浮窗 | `rounded-xl border border-zinc-100 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950` |
| 项 | `flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm` |
| 禁用项 | `opacity-40 pointer-events-none` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 复制 | — | 写剪贴板 | `onCopyMessage(messageId)` |
| 引用 | — | 填入输入区引用 | `onQuoteMessage(messageId)` |
| 撤回 | `capabilities.recall` | 本地撤回 | `onRecallMessage(messageId)` |
| 编辑 | `capabilities.edit` | 进入编辑 | `onEditMessage(messageId)` |
| Esc / 外部 | 打开 | 关闭 | `onCloseMessageMenu()` |

### 状态

- `open` / `messageId`

### 边界

- 剪贴板失败 → 共享错误反馈；非本人或无能力不显示撤回/编辑。

### 本期不做

- 服务端撤回时限策略（仅本地 capability）。

### 组件验收

- [ ] 四项按能力可见
- [ ] 复制/引用/撤回/编辑回调可接线
