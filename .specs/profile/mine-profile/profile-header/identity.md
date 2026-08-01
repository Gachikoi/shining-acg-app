# `profile.header.identity` — 身份摘要

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.header`
- **子组件** (`children`):
  - 无
- **职责**: 展示头像、昵称、认证/社刊徽章、部门类标签与 QQ 号。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 头像 | 圆形图 | 缺省灰色占位 |
| 昵称行 | 昵称 + 徽章 | 例：贺知章；黄底「社刊 vol.9 编辑」；可选勾选标 |
| 标签行 | 多枚 pill | 例：红/粉底「WOTA 艺组」可重复 |
| 标识 | QQ 号文案 | `QQ号：{qq}` |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 头像 | `size-20 shrink-0 rounded-full bg-zinc-200 object-cover dark:bg-zinc-700 sm:size-24` |
| 昵称 | `text-xl font-semibold text-zinc-900 dark:text-zinc-50` |
| 社刊徽章 | `inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200` |
| 部门标签 | `inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-950/50 dark:text-red-300` |
| QQ 文案 | `text-sm text-zinc-500 dark:text-zinc-400` |
| 标签容器 | `flex flex-wrap items-center gap-1.5` |
| 触控 | 头像若可点 ≥ `min-h-11 min-w-11`；本期头像默认不可点 |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | 本期 | 纯展示 | — |

### 状态

- props：`avatarUrl?`、`displayName`、`badges[]`、`tags[]`、`qq?`

### 边界

- 无徽章/标签时不留大块空白；长昵称 `truncate`。
- 头像加载失败 → 灰色占位。

### 本期不做

- 点击徽章/标签筛选或跳转。

### 组件验收

- [ ] 昵称、至少一类徽章与标签、QQ 文案可见且风格接近设计稿
- [ ] 无头像 URL 时占位稳定
