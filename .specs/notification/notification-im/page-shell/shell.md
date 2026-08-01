# `notification.page.shell` — 通知中心路由壳

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.page.shell`
- **职责**: 在 `/app/notification` 提供满高布局与圆角内容壳，挂载 Tab 槽与主内容槽。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 布局 | `+layout.svelte` 满高 flex | 不破坏 App Header / 侧栏 / 底栏 |
| 内容壳 | 圆角卡片 | Tab 槽 + 主内容槽 |
| 槽位 | `tabs` / `children` snippets | 由后续任务填入 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 内容壳 | `flex h-full min-h-0 flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950` |
| Tab 槽 | `shrink-0 overflow-x-auto` |
| 主内容槽 | `min-h-0 flex-1 overflow-hidden` |
| 触控 | 壳本身不可点；内部控件 ≥ `min-h-11 min-w-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | — | 纯布局容器，无业务手势 | — |

### 状态

- 无独立业务状态；由子组件驱动。

### 边界

- 子内容为空时仍保持壳结构；页级错误不得破坏 App 壳。

### 本期不做

- 全局 Header 搜索语义改造；侧栏/底栏改版。

### 组件验收

- [ ] `/app/notification` 满高且内容壳圆角边框可见
- [ ] Tab 槽与主内容槽可分别挂载内容
