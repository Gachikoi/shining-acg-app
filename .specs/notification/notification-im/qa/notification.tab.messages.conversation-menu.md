# QA · `notification.tab.messages.conversation-menu`

- **task_id**：`notification.tab.messages.conversation-menu`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/conversation-menu.md`
- **入口**：/app/notification → 我的消息
- **Mock 依赖**：无

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 菜单项与关闭

### 1. 功能点简介

菜单项与关闭（对齐组件验收）。

### 2. 如何测试

打开菜单，确认举报/置顶/删除；Esc 或点外部关闭。

### 3. 怎样算通过

- [ ] 三项同构可见
- [ ] Esc/外部关闭

