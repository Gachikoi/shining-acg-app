# QA · `notification.shared.state-feedback`

- **task_id**：`notification.shared.state-feedback`
- **关联 spec**：`.specs/notification/notification-im/shared/state-feedback.md`
- **入口**：各 Tab 空/错态（或组件 props 切换）
- **Mock 依赖**：可临时清空 mock 验空态

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 五态反馈

### 1. 功能点简介

五态反馈（对齐组件验收）。

### 2. 如何测试

确认 empty/loading/error/unavailable/success 可用；错误重试触控 ≥44。

### 3. 怎样算通过

- [ ] 空/载/错/未接入可区分
- [ ] 重试按钮够大

