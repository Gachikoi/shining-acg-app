# QA · `notification.tab.new-follow.item`

- **task_id**：`notification.tab.new-follow.item`
- **关联 spec**：`.specs/notification/notification-im/tab-new-follow/item.md`
- **入口**：/app/notification → 新增关注
- **Mock 依赖**：new-follow/mock-data.ts

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 私信与回关

### 1. 功能点简介

私信与回关（对齐组件验收）。

### 2. 如何测试

点私信/回关；已关注态防重复提交。

### 3. 怎样算通过

- [ ] 私信触发 onStartDm
- [ ] 回关本地态
- [ ] 已关注不可重复点

