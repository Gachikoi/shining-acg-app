# `notification.tab.messages.message-list` — 消息列表

- **设计源**: [`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 按时间展示收/发消息；进入与本地发送后滚到最新。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 列表 | `message-item` | 时间序 |
| 滚动 | 容器 | 锚到底部 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | 首次进入会话 / 本地发送成功 | 滚动到最新 | `scrollToLatest()`（内部） |

### 状态

- `messages`；滚动锁定策略（用户上翻时可不强制）

### 边界

- 空消息显示共享空态；超长列表虚拟化为本期可选，不强制。

### 本期不做

- 历史分页拉取 API。

### 组件验收

- [ ] 收/发方向由 message-item 区分
- [ ] 进入与发送后滚底（或等价可见最新）
