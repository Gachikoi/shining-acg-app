# `notification.page.shell.tabs` — 五分类 Tab 条

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.page.shell`
- **职责**: 固定展示五个分类 Tab，表达分类色、活动态与数量角标。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| Tablist | 五个 pill 按钮 | 顺序：我的消息 → 评论和@ → 赞和收藏 → 新增关注 → 晒你通知 |
| 图标 | 心形/分类图标 | 圆形底 |
| 角标 | 未读数 Badge | 0 隐藏；1–99 数字；>99 为 `99+` |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex min-h-11 flex-wrap items-center gap-2`；`role="tablist"` |
| 按钮基类 | `relative inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold` |
| 焦点环 | `focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2` |
| 我的消息 idle / active | idle `bg-amber-100 text-zinc-900 dark:bg-amber-950/50`；active `bg-amber-400 text-white ring-2 ring-amber-500 ring-offset-2` |
| 评论和@ | idle `bg-emerald-100`；active `bg-emerald-500 text-white ring-2 ring-emerald-600` |
| 赞和收藏 | idle `bg-red-100`；active `bg-red-500 text-white ring-2 ring-red-600` |
| 新增关注 | idle `bg-sky-100`；active `bg-sky-500 text-white ring-2 ring-sky-600` |
| 晒你通知 | idle `bg-zinc-100 dark:bg-zinc-800`；active `bg-zinc-500 text-white ring-2 ring-zinc-600` |
| 角标 | `absolute -top-1.5 -right-1 min-w-5 ... text-[0.625rem]`（Badge） |
| 触控 | 每个 Tab ≥ `min-h-11 min-w-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键单击 | — | 选中该 Tab | `onTabChange(tabId)` / `$bindable activeTab` |
| Enter / Space | 聚焦时 | 同左键 | 同上 |
| ArrowLeft / ArrowRight | 聚焦时 | 循环切换并聚焦下一 Tab | `onTabChange(nextId)` |
| — | 角标为 0 | 不渲染 Badge | — |

### 状态

- `activeTab: NotificationTabId`
- `unreadCounts: Record<NotificationTabId, number>`

### 边界

- 未知 `tabId` 忽略；暗色下 ring-offset 用 `dark:ring-offset-zinc-950`。

### 本期不做

- Tab 图标按分类换成不同 lucide 图标（当前可统一心形，后续可迭代）。

### 组件验收

- [ ] 五 Tab 固定顺序与标签文案正确
- [ ] 活动态含分类色 + ring 描边 + `aria-selected`
- [ ] 角标格式化符合 0 / 1–99 / `99+`
- [ ] 键盘可切换并激活
