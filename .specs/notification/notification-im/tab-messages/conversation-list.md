# `notification.tab.messages.conversation-list` — 会话列表

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 可滚动会话列表；置顶组优先；无选择时右侧/详情区显示空态。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 列表 | `conversation-item` 集合 | 置顶在前 |
| 空态（详情侧） | 文案 | 「快找小伙伴聊天吧 ( · - · )つ口」 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 列表容器 | `flex h-full min-h-0 flex-col overflow-y-auto` |
| 空态文案 | `flex flex-1 items-center justify-center text-zinc-300 dark:text-zinc-600` |
| 触控 | 列表项见 conversation-item |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | 无 `activeConversationId` | 详情区显示空态 | — |
| — | 列表变化 | 保持置顶组稳定排序 | `sortConversations(list)`（内部） |

### 状态

- `conversations`；滚动位置本地保留。

### 边界

- 空列表时列表区可显示共享空态；详情空态与列表空态区分。

### 本期不做

- 会话搜索（全局 Header 搜索不变；会话内搜索见 chat-header）。

### 组件验收

- [ ] 置顶会话排在非置顶之前
- [ ] 无选中会话时详情空态文案可见
