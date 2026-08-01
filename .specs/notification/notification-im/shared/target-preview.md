# `notification.shared.target-preview` — 通知目标预览

- **设计源**: [`.design/notification/comment/image.png`](../../../../.design/notification/comment/image.png)
- **父节点**: `notification.shared`
- **职责**: 右侧缩略图与评论引用条。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 缩略图 | 图 / 色块占位 | |
| 引用 | 左边框摘要 | |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 缩略图 | `size-16 rounded-lg object-cover bg-zinc-200 dark:bg-zinc-800` |
| 引用 | `border-l-2 border-zinc-200 pl-2 text-xs text-zinc-400` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键·缩略图 | 可选 | 打开目标（本期占位） | `onOpenTarget(targetId)` |

### 状态

- 媒体缺失 / 加载失败

### 边界

- 缺失时稳定占位，不导致列表跳动。

### 本期不做

- 真实媒体 CDN 策略。

### 组件验收

- [ ] 有/无媒体布局稳定
- [ ] 引用条样式正确
