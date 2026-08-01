# QA · `notification.tab.comment-mention`

- **task_id**：`notification.tab.comment-mention`
- **关联 spec**：`.specs/notification/notification-im/tab-comment-mention/comment-mention.md`
- **入口**：/app/notification → 评论和@
- **Mock 依赖**：comment-mention/mock-data.ts（TEMP MOCK）

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 列表与已读

### 1. 功能点简介

列表与已读（对齐组件验收）。

### 2. 如何测试

打开 Tab，确认四类 Mock 与空/载/错态能力；角标清零。

### 3. 怎样算通过

- [ ] 列表可见
- [ ] 打开后本地已读

