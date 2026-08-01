# QA · `notification.tab.messages.composer`

- **task_id**：`notification.tab.messages.composer`
- **关联 spec**：`.specs/notification/notification-im/tab-messages/composer.md`
- **入口**：/app/notification → 会话详情
- **Mock 依赖**：图片为本地预览；语音/通话占位

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 发送与占位

### 1. 功能点简介

发送与占位（对齐组件验收）。

### 2. 如何测试

输入文本（≤1000）；Enter 发送、Shift+Enter 换行；空白不可发；点语音/通话看占位。

### 3. 怎样算通过

- [ ] maxlength=1000
- [ ] Enter/Shift+Enter 正确
- [ ] 空白不可发
- [ ] 语音/通话占位不伪装成功

