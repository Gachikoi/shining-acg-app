# QA · `notification.tab.new-follow`

- **task_id**：`notification.tab.new-follow`
- **关联 spec**：`.specs/notification/notification-im/tab-new-follow/new-follow.md`
- **入口**：/app/notification → 新增关注
- **Mock 依赖**：new-follow/mock-data.ts（TEMP MOCK）

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 列表与私信编排

### 1. 功能点简介

列表与私信编排（对齐组件验收）。

### 2. 如何测试

打开 Tab；点私信应切到消息并打开/创建会话。

### 3. 怎样算通过

- [ ] 列表可见
- [ ] 私信切消息 Tab

