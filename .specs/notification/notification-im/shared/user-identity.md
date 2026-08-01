# `notification.shared.user-identity` — 用户身份摘要

- **设计源**: [`.design/notification/follow/image.png`](../../../../.design/notification/follow/image.png)
- **父节点**: `notification.shared`
- **职责**: 头像、在线点、昵称、认证、标签与缺省头像。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 头像 | img / 占位 | |
| 文本 | 昵称 + 徽章 + 标签 | 可复用 user-badge-row |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 头像 | `size-12 rounded-full bg-zinc-900 object-cover` |
| 在线点 | `bg-emerald-500 ring-2 ring-white dark:ring-zinc-950` |
| 昵称 | `text-sm font-semibold text-zinc-900 dark:text-zinc-50` |
| 标签 | `truncate` + 单行；`border-red-200 text-red-400` 类可选 |
| 触控 | 若可点：整块 ≥ `min-h-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键 | `interactive` | 可选打开用户 | `onUserClick(userId)`（可选；本期可 TODO） |

### 状态

- 图片加载失败 → 占位

### 边界

- 昵称/标签超长截断；提供 accessible name。

### 本期不做

- 强制跳转主页。

### 组件验收

- [ ] 缺省头像与标签溢出处理
- [ ] 暗色对比可读
