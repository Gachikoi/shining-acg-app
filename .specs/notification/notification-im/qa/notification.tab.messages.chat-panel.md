# QA · `notification.tab.messages.chat-panel`

- **task_id**：`notification.tab.messages.chat-panel`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/chat-panel.md`
- **入口**：/app/notification → 我的消息 → 选中会话
- **Mock 依赖**：messages/mock-data.ts

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 详情面板组合

### 1. 功能点简介

详情面板组合（对齐组件验收）。

### 2. 如何测试

选中会话查看 header/list/composer；窄屏从列表进详情。

### 3. 怎样算通过

- [ ] 三区齐全
- [ ] 无选中时空态

