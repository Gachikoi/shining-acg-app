# `profile.header.stats` — 统计行

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.header`
- **子组件** (`children`):
  - 无
- **职责**: 展示关注、粉丝、获赞与收藏三项计数。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 三项 | 标签 + 数字 | 「关注」「粉丝」「获赞与收藏」 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex flex-wrap items-center gap-4 text-sm` |
| 项 | `inline-flex items-baseline gap-1` |
| 标签 | `text-zinc-500 dark:text-zinc-400` |
| 数字 | `font-semibold text-zinc-900 dark:text-zinc-50` |
| 触控 | 若可点整项 ≥ `min-h-11`；`px-1` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键单击项 | — | 占位 | `onStatClick('following' \| 'followers' \| 'likesCollect')` → toast「暂未开放」+ TODO |
| Enter / Space | 聚焦时 | 同左键 | 同上 |

### 状态

- props：`followingCount`、`followersCount`、`likesCollectCount`（number）

### 边界

- 计数 ≥ 0；超大数可直接数字展示（不强制 `99+`，设计稿为 99）。

### 本期不做

- 真实粉丝/关注列表页跳转。

### 组件验收

- [ ] 三项文案与数字可见
- [ ] 点击触发占位回调而非假跳转
