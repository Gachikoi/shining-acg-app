# QA · `notification.tab.messages.conversation-dialogs`

- **task_id**：`notification.tab.messages.conversation-dialogs`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/conversation-dialogs.md`
- **入口**：/app/notification → 我的消息
- **Mock 依赖**：无

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 举报/删除确认

### 1. 功能点简介

举报/删除确认（对齐组件验收）。

### 2. 如何测试

触发举报与删除，确认二次对话框；删除后详情回到稳定空态或下一会话。

### 3. 怎样算通过

- [ ] 有二次确认
- [ ] 删除后稳定详情态
- [ ] 举报本地反馈且不伪装成功

