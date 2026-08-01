# `notification.tab.comment-mention.item` — 评论/@通知项

- **设计源**: [`.design/notification/comment/image.png`](../../../../.design/notification/comment/image.png)
- **父节点**: `notification.tab.comment-mention`
- **职责**: 展示四类：回复评论、评论帖子、评论中@、帖子中@。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 左 | 头像 | shared.user-identity |
| 中 | 昵称 + 动作 + 时间 + 正文 + 被回复摘要 | |
| 右 | 帖子缩略图 | shared.target-preview |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 行 | `flex items-start gap-4 px-4 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50` |
| 未读行 | `bg-zinc-50 dark:bg-zinc-900/40` |
| 昵称 | `text-sm font-semibold text-zinc-900 dark:text-zinc-50` |
| 动作/时间 | `text-sm text-zinc-500`；时间 `text-zinc-400` |
| 正文 | `mt-1 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200` |
| 引用摘要 | `mt-2 border-l-2 border-zinc-200 pl-2 text-xs text-zinc-400` |
| 缩略图 | `size-16 shrink-0 rounded-lg object-cover` |
| 触控 | 行可点区域 ≥ `min-h-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键单击行 | — | 「暂未开放」+ TODO | `onOpenNotificationTarget({ type, id })` |
| Enter / Space | 聚焦 | 同上 | 同上 |

### 状态

- `read` / 字段缺失标志

### 边界

- 缺正文/摘要/缩略图/commentId 时隐藏对应块但保持对齐。

### 本期不做

- 真实跳转定位。

### 组件验收

- [ ] 四类动作文案可区分
- [ ] 点击仅占位反馈，不伪造跳转成功

### Tab · 赞和收藏

- **id**: `notification.tab.like-collect`
- **设计源**: [`.design/notification/like/image.png`](../../../../.design/notification/like/image.png)
- **职责**: 单列展示赞帖子、收藏帖子、赞评论。
- **子组件**:
  - `notification.tab.like-collect`
  - `notification.tab.like-collect.item`
- **编排交互**: 同评论 Tab（已读 + 点击占位）。
- **复用关系**: `V1LikeCollectNotification`；列表骨架可与评论 Tab 共享。
