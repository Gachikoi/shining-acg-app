# QA · `notification.tab.messages.conversation-list`

- **task_id**：`notification.tab.messages.conversation-list`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/conversation-list.md`
- **入口**：/app/notification → 我的消息
- **Mock 依赖**：messages/mock-data.ts

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 排序与空态

### 1. 功能点简介

排序与空态（对齐组件验收）。

### 2. 如何测试

观察置顶会话优先；无选中时详情区空态文案。

### 3. 怎样算通过

- [ ] 置顶优先
- [ ] 空态文案可见

