# `notification.tab.new-follow.item` — 新增关注通知项

- **设计源**: [`.design/notification/follow/image.png`](../../../../.design/notification/follow/image.png)
- **父节点**: `notification.tab.new-follow`
- **职责**: 身份摘要 + 私信/回关/已关注按钮。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 左 | 头像 + 昵称 + 徽章/标签 + 「开始关注了」+ 时间 | shared |
| 右 | 动作按钮 | 私信 / 回关 / 已关注 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 行 | `flex items-center justify-between gap-4 px-4 py-5 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50` |
| 昵称 | `text-sm font-semibold text-zinc-900 dark:text-zinc-50` |
| 标签 | `rounded border border-red-200 px-1.5 text-xs text-red-400` |
| 次文案 | `text-sm text-zinc-500` |
| 私信 | `min-h-11 rounded-full border border-red-500 px-6 text-sm text-red-500 hover:bg-red-50` |
| 回关 | `min-h-11 rounded-full bg-red-500 px-6 text-sm text-white hover:bg-red-600` |
| 已关注 | `min-h-11 rounded-full border border-zinc-300 px-6 text-sm text-zinc-600`（禁用或次要） |
| 触控 | 按钮 ≥ `min-h-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键·私信 | — | 进入/创建会话 | `onStartDm(userId)` |
| 左键·回关 | 未关注 | 本地关注，防重复 | `onFollowBack(userId)` |
| Enter / Space | 聚焦按钮 | 同上 | 同上 |

### 状态

- `relation: 'none' \| 'following' \| 'mutual' \| 'unknown'`

### 边界

- 标签过多单行截断 + accessible name；`unknown` 禁用并提示重试。

### 本期不做

- 真实关注 API。

### 组件验收

- [ ] 私信/回关/已关注三态按钮样式正确
- [ ] 回关防重复点击

### Tab · 晒你通知

- **id**: `notification.tab.system`
- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **职责**: 保留系统通知入口，本期不实现列表。
- **子组件**:
  - `notification.tab.system`
  - `notification.tab.system.placeholder`
- **编排交互**: Tab 可选中；进入不自动清未读。
- **复用关系**: shared.state-feedback；后续可对齐 `V1SystemNotification`。
