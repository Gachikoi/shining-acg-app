# QA · `notification.tab.messages.message-menu`

- **task_id**：`notification.tab.messages.message-menu`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/message-menu.md`
- **入口**：/app/notification → 会话详情
- **Mock 依赖**：无

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 按能力显示操作

### 1. 功能点简介

按能力显示操作（对齐组件验收）。

### 2. 如何测试

对可复制/引用/撤回/编辑消息分别打开菜单，确认项按 capability 显示。

### 3. 怎样算通过

- [ ] 仅显示允许的操作
- [ ] 复制失败有 toast

