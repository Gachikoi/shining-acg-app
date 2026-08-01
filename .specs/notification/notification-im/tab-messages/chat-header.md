# `notification.tab.messages.chat-header` — 会话资料头

- **设计源**: [`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 展示对方资料、关注、会话内搜索与菜单；窄屏含返回。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 左 | 返回（窄屏）+ 头像 + 昵称/标签 + 签名 | 身份复用 shared |
| 右 | 关注按钮 + 搜索 + 菜单 | |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex min-h-14 items-center gap-3 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800` |
| 昵称 | `text-sm font-semibold text-zinc-900 dark:text-zinc-50` |
| 签名/在线摘要 | `text-xs text-zinc-500` |
| 关注按钮 | `min-h-11 rounded-full bg-red-500 px-4 text-sm font-medium text-white hover:bg-red-600` |
| 已关注 | `border border-zinc-300 bg-transparent text-zinc-700 dark:border-zinc-600 dark:text-zinc-200`（若设计为描边） |
| 图标钮 | `inline-flex size-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100` |
| 触控 | 返回/关注/搜索/菜单 ≥ `min-h-11 min-w-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键·返回 | 窄屏 | 回列表 | `onBackToList()` |
| 左键·关注 | — | 本地切换关注 | `onToggleFollow(userId)` |
| 左键·搜索 | — | 打开会话内搜索 | `onToggleThreadSearch(open)` |
| 左键·菜单 | — | 打开会话操作（同右键菜单） | `onOpenConversationMenu(conversationId, anchor)` |
| Enter / Space | 聚焦按钮 | 同左键 | 同上 |

### 状态

- `following` / `threadSearchOpen`

### 边界

- 全局 Header 搜索不变；会话搜索仅过滤当前本地消息。

### 本期不做

- 真实关注 API；跳转用户主页可 TODO。

### 组件验收

- [ ] 资料区与三个动作入口可见
- [ ] 窄屏返回触发 `onBackToList`
- [ ] 关注本地切换且有适配点注释
