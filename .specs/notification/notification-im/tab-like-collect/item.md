# `notification.tab.like-collect.item` — 赞/收藏通知项

- **设计源**: [`.design/notification/like/image.png`](../../../../.design/notification/like/image.png)
- **父节点**: `notification.tab.like-collect`
- **职责**: 三类动作项 UI。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 左 | 头像 | |
| 中 | 昵称 + 动作 + 时间 + 可选评论/摘要 | |
| 右 | 缩略图 | |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 行 | 同评论项：`flex items-start gap-4 px-4 py-4 ...` |
| 未读 | `bg-zinc-50 dark:bg-zinc-900/40` |
| 文本层级 | 同评论项 zinc 阶梯 |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键单击 | — | 「暂未开放」+ TODO | `onOpenNotificationTarget({ type, id })` |

### 状态

- `read`

### 边界

- 未知类型安全兜底文案；结构不跳动。

### 本期不做

- 真实跳转。

### 组件验收

- [ ] 三类动作可区分
- [ ] 点击仅占位反馈

### Tab · 新增关注

- **id**: `notification.tab.new-follow`
- **设计源**: [`.design/notification/follow/image.png`](../../../../.design/notification/follow/image.png)
- **职责**: 新关注用户列表与私信/回关。
- **子组件**:
  - `notification.tab.new-follow`
  - `notification.tab.new-follow.item`
- **编排交互**:
  1. Tab 打开 → 本地已读。
  2. 私信 → 切 messages 并选中/创建会话。
  3. 回关 → 本地关注态，防重复提交。
- **复用关系**: `V1FollowNotification`；shared.user-identity。
