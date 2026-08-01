# QA · `notification.tab.messages.message-list`

- **task_id**：`notification.tab.messages.message-list`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/message-list.md`
- **入口**：/app/notification → 会话详情
- **Mock 依赖**：messages/mock-data.ts

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 列表滚动与方向

### 1. 功能点简介

列表滚动与方向（对齐组件验收）。

### 2. 如何测试

进入会话与发送后确认滚底；收/发气泡方向区分。

### 3. 怎样算通过

- [ ] 进入滚底
- [ ] 发送后滚底
- [ ] 方向样式正确

