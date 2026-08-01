# Tab · 评论和@

> 子需求编排（短）。组件详述见同目录文件。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `notification.tab.comment-mention`
- **设计源**: [`.design/notification/comment/image.png`](../../../../.design/notification/comment/image.png)
- **职责**: 单列展示四类互动通知。
- **子组件**:
  - [`notification.tab.comment-mention`](comment-mention.md) — 评论和@ Tab 编排
  - [`notification.tab.comment-mention.item`](item.md) — 评论/@通知项
- **编排交互**:
  1. Tab 打开 → `onTabMarkedRead('comment-mention')`。
  2. 项点击 → 本期 `onOpenNotificationTarget` 仅「暂未开放」+ TODO。
- **复用关系**: 形状对齐 `V1CommentMentionNotification`；复用 shared 用户/预览/状态。
