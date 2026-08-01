# QA · `notification.shared.user-identity`

- **task_id**：`notification.shared.user-identity`
- **关联 spec**：`.specs/notification/notification-im/shared/user-identity.md`
- **入口**：评论/赞/关注等列表项
- **Mock 依赖**：各 Tab mock 用户字段

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 身份摘要展示

### 1. 功能点简介

身份摘要展示（对齐组件验收）。

### 2. 如何测试

在列表项中查看头像、昵称、认证/标签；头像失败占位。

### 3. 怎样算通过

- [ ] 头像与昵称可见
- [ ] 失败有占位

