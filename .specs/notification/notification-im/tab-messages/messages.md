# `notification.tab.messages` — 我的消息 Tab 编排与 Mock 适配层

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 建立 typed 本地会话/消息模型与 Tab 级状态，供子组件消费；UI 适配层与后续 API 可替换。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 模型 | Conversation / Message 类型 | 独立于生成 API |
| 状态 | 列表、当前会话、消息、菜单 | runes/store |
| 面板 | 挂载 list + chat-panel | 经 responsive 布局 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| Tab 面板 | `h-full min-h-0`；`role="tabpanel"` `id="notification-panel-messages"` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | Tab 激活 | 展示编排后的列表/详情 | 父级 `activeTab === 'messages'` |

### 状态

- `conversations` / `activeConversationId` / `messagesByConversationId` / 菜单与弹窗开关

### 边界

- 无后端时使用 Mock；不得手改 `packages/web/src/lib/api/**`。

### 本期不做

- 真实 IM API / WebSocket。

### 组件验收

- [ ] 本地类型与适配层与 UI 分离
- [ ] Tab 面板可挂载列表与详情
