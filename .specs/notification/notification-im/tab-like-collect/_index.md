# Tab · 赞和收藏

> 子需求编排（短）。组件详述见同目录文件。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `notification.tab.like-collect`
- **设计源**: [`.design/notification/like/image.png`](../../../../.design/notification/like/image.png)
- **职责**: 单列展示赞帖子、收藏帖子、赞评论。
- **子组件**:
  - [`notification.tab.like-collect`](like-collect.md) — 赞和收藏 Tab 编排
  - [`notification.tab.like-collect.item`](item.md) — 赞/收藏通知项
- **编排交互**:
同评论 Tab（已读 + 点击占位）。
- **复用关系**: `V1LikeCollectNotification`；列表骨架可与评论 Tab 共享。
