# QA · `notification.page.shell.tabs`

- **task_id**：`notification.page.shell.tabs`
- **关联 spec**：`.specs/notification/notification-im/page-shell/tabs.md`
- **入口**：/app/notification
- **Mock 依赖**：角标依赖 unread-state 本地计数

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 五 Tab 切换与活动态

### 1. 功能点简介

五 Tab 切换与活动态（对齐组件验收）。

### 2. 如何测试

依次点击五个 Tab；用键盘 ArrowLeft/Right、Enter/Space 切换。

### 3. 怎样算通过

- [ ] 顺序为：我的消息→评论和@→赞和收藏→新增关注→晒你通知
- [ ] 活动态有分类色 + ring
- [ ] 键盘可切换

## 功能点 2 · 未读角标

### 1. 功能点简介

未读角标（对齐组件验收）。

### 2. 如何测试

观察有未读时角标数字；清零后角标消失；>99 显示 99+（若 mock 有）。

### 3. 怎样算通过

- [ ] 0 不渲染 Badge
- [ ] 角标可读

