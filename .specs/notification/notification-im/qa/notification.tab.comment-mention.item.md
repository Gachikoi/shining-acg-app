# QA · `notification.tab.comment-mention.item`

- **task_id**：`notification.tab.comment-mention.item`
- **关联 spec**：`.specs/notification/notification-im/tab-comment-mention/item.md`
- **入口**：/app/notification → 评论和@
- **Mock 依赖**：comment-mention/mock-data.ts

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 项点击占位

### 1. 功能点简介

项点击占位（对齐组件验收）。

### 2. 如何测试

点击一项，应 toast「暂未开放」且不跳转伪造详情。

### 3. 怎样算通过

- [ ] 可见身份与预览
- [ ] 点击暂未开放

