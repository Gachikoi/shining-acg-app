# QA · `notification.tab.messages`

- **task_id**：`notification.tab.messages`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/messages.md`
- **入口**：/app/notification → 我的消息
- **Mock 依赖**：messages/mock-data.ts（TEMP MOCK）

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · Mock 会话编排

### 1. 功能点简介

Mock 会话编排（对齐组件验收）。

### 2. 如何测试

进入我的消息，确认列表与详情由本地状态驱动且 UI 与适配层分离。

### 3. 怎样算通过

- [ ] 可见 Mock 会话列表
- [ ] 切换会话详情更新

