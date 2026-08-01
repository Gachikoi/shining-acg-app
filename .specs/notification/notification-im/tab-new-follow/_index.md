# Tab · 新增关注

> 子需求编排（短）。组件详述见同目录文件。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `notification.tab.new-follow`
- **设计源**: [`.design/notification/follow/image.png`](../../../../.design/notification/follow/image.png)
- **职责**: 新关注用户列表与私信/回关。
- **子组件**:
  - [`notification.tab.new-follow`](new-follow.md) — 新增关注 Tab 编排
  - [`notification.tab.new-follow.item`](item.md) — 新增关注通知项
- **编排交互**:
  1. Tab 打开 → 本地已读。
  2. 私信 → 切 messages 并选中/创建会话。
  3. 回关 → 本地关注态，防重复提交。
- **复用关系**: `V1FollowNotification`；shared.user-identity。
