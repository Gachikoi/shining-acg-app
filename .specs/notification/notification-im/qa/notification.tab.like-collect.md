# QA · `notification.tab.like-collect`

- **task_id**：`notification.tab.like-collect`
- **关联 spec**：`.specs/notification/notification-im/tab-like-collect/like-collect.md`
- **入口**：/app/notification → 赞和收藏
- **Mock 依赖**：like-collect/mock-data.ts（TEMP MOCK）

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 三类列表与已读

### 1. 功能点简介

三类列表与已读（对齐组件验收）。

### 2. 如何测试

打开 Tab 查看三类 Mock；确认状态反馈与已读。

### 3. 怎样算通过

- [ ] 三类可见
- [ ] 打开已读

