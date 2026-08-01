# `profile.content.post-card` — 内容卡片

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.content.grid`
- **子组件** (`children`):
  - 无
- **职责**: 单条内容预览：封面、标题、作者、点赞数。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 封面 | 竖图 / 表格类截图 | `object-cover`；失败占位 |
| 标题 | 单行/两行 | 例：「朋友好吃」 |
| 底栏左 | 小头像 + 作者名 | |
| 底栏右 | 心形 + 数字 | 例：108 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex flex-col gap-2` |
| 封面 | `aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800` |
| 封面图 | `size-full object-cover` |
| 标题 | `line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50` |
| 底栏 | `flex items-center justify-between gap-2` |
| 作者 | `flex min-w-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300` |
| 作者头像 | `size-5 shrink-0 rounded-full bg-zinc-200 object-cover` |
| 点赞 | `inline-flex items-center gap-1 text-xs text-zinc-500` |
| 触控 | 卡片主热区与点赞热区均 ≥ `min-h-11`（点赞可用独立按钮） |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键·卡片非点赞区 | — | 占位打开 | `onOpenPost(postId)` → toast「暂未开放」+ TODO |
| 左键·点赞 | — | 本地可切换高亮（可选）或占位 | `onToggleLike(postId)`；无 API 时仅本地 Mock 或 toast + TODO |
| Enter / Space | 卡片聚焦 | 同打开 | `onOpenPost` |

### 状态

- props：`id`、`coverUrl?`、`title`、`authorName`、`authorAvatarUrl?`、`likeCount`、`liked?: boolean`

### 边界

- 无封面 → 灰底占位。
- 标题过长省略。

### 本期不做

- 真实帖子详情路由与点赞 API。

### 组件验收

- [ ] 封面、标题、作者、赞数结构齐全
- [ ] 打开与点赞有明确回调且不假跳转成功页
