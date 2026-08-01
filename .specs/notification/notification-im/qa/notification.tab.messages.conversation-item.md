# QA · `notification.tab.messages.conversation-item`

- **task_id**：`notification.tab.messages.conversation-item`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/conversation-item.md`
- **入口**：/app/notification → 我的消息
- **Mock 依赖**：messages/mock-data.ts

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 会话项展示与选择

### 1. 功能点简介

会话项展示与选择（对齐组件验收）。

### 2. 如何测试

查看头像/在线/未读/时间；单击选中；桌面右键与触屏侧滑入口。

### 3. 怎样算通过

- [ ] 在线绿点/未读可见
- [ ] 单击选中
- [ ] 右键或侧滑可开菜单

