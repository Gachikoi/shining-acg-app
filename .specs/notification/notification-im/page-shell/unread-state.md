# `notification.page.shell.unread-state` — 未读状态协调器

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.page.shell`
- **职责**: 聚合会话与四类通知未读数；在打开会话或指定 Tab 后执行本地已读并同步角标。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 适配层 | store / runes | 与 UI 分离的本地未读模型 |
| 输出 | `unreadCounts` | 供 tabs 绑定 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| — | 无独立视觉；角标样式见 tabs |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | 打开会话 | 该会话未读清零并重算 messages 角标 | `onConversationOpened(conversationId)` |
| — | 打开评论/@ Tab | 已加载项本地已读，角标清零 | `onTabMarkedRead('comment-mention')` |
| — | 打开赞和收藏 Tab | 同上 | `onTabMarkedRead('like-collect')` |
| — | 打开新增关注 Tab | 同上 | `onTabMarkedRead('new-follow')` |
| — | 打开晒你通知 Tab | **不**自动清零 | — |

### 状态

- `unreadCounts`；各 Tab/会话的已读游标（本地）。

### 边界

- 负数或 NaN 视为 0；系统 Tab 占位阶段不产生假已读。

### 本期不做

- 真实 mark-read API 请求（可留适配点）。

### 组件验收

- [ ] tabs 角标与本地未读源一致
- [ ] 打开会话/前三类互动 Tab 后角标按规则更新
- [ ] 系统 Tab 打开不自动清零
