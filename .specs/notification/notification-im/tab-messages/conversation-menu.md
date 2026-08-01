# `notification.tab.messages.conversation-menu` — 会话右键/侧滑操作

- **设计源**: [`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 桌面浮窗与触屏侧滑同构提供举报、置顶/取消置顶、删除。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 桌面浮窗 | 三项操作 | 举报 / 置顶 / 删除 |
| 侧滑栏 | 三色操作钮 | 灰 / 绿 / 红 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 浮窗 | `min-w-[7.5rem] rounded-xl border border-zinc-100 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950` |
| 菜单项 | `flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-zinc-800 dark:text-zinc-100` |
| 删除项文本 | `text-red-500` |
| 侧滑·举报 | `bg-zinc-600 text-white` |
| 侧滑·置顶 | `bg-emerald-500 text-white` |
| 侧滑·删除 | `bg-red-500 text-white` |
| 触控 | 每项 ≥ `min-h-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键·举报 | 菜单开 | 关闭菜单并请求确认 | `onReportConversation(conversationId)` |
| 左键·置顶 | 菜单开 | 切换置顶并关闭 | `onTogglePinConversation(conversationId)` |
| 左键·删除 | 菜单开 | 关闭菜单并请求确认 | `onDeleteConversation(conversationId)` |
| 点击外部 / Esc | 菜单开 | 关闭 | `onCloseConversationMenu()` |
| 侧滑按钮 | 触屏已露出 | 同构上述三项 | 同上回调 |

### 状态

- `open` / `conversationId` / `anchor` / `swipeOpenId`

### 边界

- 同时仅一个菜单或侧滑；完成操作后关闭。

### 本期不做

- 真实举报/删除 API。

### 组件验收

- [ ] 桌面右键与触屏侧滑三项同构
- [ ] Esc/外部点击关闭
- [ ] 删除项为 `text-red-500` 或红底
