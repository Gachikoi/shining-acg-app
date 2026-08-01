# `notification.tab.messages.chat-panel` — 会话详情面板

- **设计源**: [`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 组合资料头、消息区、输入区；桌面右栏 / 窄屏独立详情。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 头 | `chat-header` | |
| 中 | `message-list` | `flex-1 overflow-y-auto` |
| 底 | `composer` | `shrink-0` |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 面板 | `flex h-full min-h-0 flex-col` |
| 无会话 | 不渲染面板，由 list 空态占据 |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | `activeConversationId` 有值 | 展示三区 | — |
| 窄屏返回 | 见 header | 回列表 | `onBackToList()` |

### 状态

- 依赖当前会话 id

### 边界

- 会话被删除后卸载面板。

### 本期不做

- 多选会话 / 群聊。

### 组件验收

- [ ] 有会话时头/列表/输入齐全
- [ ] 窄屏可作为单页详情
