# QA · `notification.page.shell.unread-state`

- **task_id**：`notification.page.shell.unread-state`
- **关联 spec**：`.specs/notification/notification-im/page-shell/unread-state.md`
- **入口**：/app/notification
- **Mock 依赖**：会话/Tab 本地未读

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 打开会话清未读

### 1. 功能点简介

打开会话清未读（对齐组件验收）。

### 2. 如何测试

在我的消息选中未读会话，观察该会话与消息 Tab 角标。

### 3. 怎样算通过

- [ ] 会话未读清零并回写角标

## 功能点 2 · 互动 Tab 已读

### 1. 功能点简介

互动 Tab 已读（对齐组件验收）。

### 2. 如何测试

打开评论和@ / 赞和收藏 / 新增关注，观察对应角标清零；晒你通知不因打开而清零。

### 3. 怎样算通过

- [ ] 前三类 Tab 打开后角标清零
- [ ] system 不清零

