# QA · `notification.tab.messages.message-item`

- **task_id**：`notification.tab.messages.message-item`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/message-item.md`
- **入口**：/app/notification → 会话详情
- **Mock 依赖**：messages/mock-data.ts

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 气泡样式与菜单入口

### 1. 功能点简介

气泡样式与菜单入口（对齐组件验收）。

### 2. 如何测试

观察己方气泡底色；右键/长按打开消息菜单。

### 3. 怎样算通过

- [ ] 己方气泡强调色可见
- [ ] 可打开消息菜单

