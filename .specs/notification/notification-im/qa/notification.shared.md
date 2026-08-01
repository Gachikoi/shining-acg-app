# QA · `notification.shared`

- **task_id**：`notification.shared`
- **关联 spec**：`.specs/notification/notification-im/shared/shared.md`
- **入口**：被各 Tab 引用（无可视独立路由）
- **Mock 依赖**：无

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 共享出口

### 1. 功能点简介

共享出口（对齐组件验收）。

### 2. 如何测试

确认 shared/index.ts 导出身份/预览/状态组件；时间格式化可复用。

### 3. 怎样算通过

- [ ] export 齐全
- [ ] 无可视独立页——经各 Tab 间接验证

