# `profile.content.tabs` — 内容 Tab

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.content`
- **子组件** (`children`):
  - 无
- **职责**: 固定三个 Tab：帖子、收藏、点赞；收藏与点赞展示锁图标。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| Tablist | 三个 pill | 顺序：帖子 → 收藏 → 点赞 |
| 锁图标 | lucide `Lock` | 仅收藏、点赞 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex min-h-11 flex-wrap items-center justify-center gap-2`；`role="tablist"` |
| 按钮基类 | `inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium` |
| idle | `bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800` |
| active | `bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50` |
| 锁图标 | `size-3.5 shrink-0 text-zinc-500` |
| 焦点 | `focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2` |
| 触控 | 每个 Tab ≥ `min-h-11 min-w-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键单击 | — | 选中该 Tab | `onTabChange(tabId)` / `$bindable activeTab` |
| Enter / Space | 聚焦时 | 同左键 | 同上 |
| ArrowLeft / ArrowRight | 聚焦时 | 循环切换 | `onTabChange(nextId)` |

`tabId`: `'posts' | 'favorites' | 'likes'`

### 状态

- `activeTab: ProfileContentTabId`
- 锁为静态展示（不表示 disabled）

### 边界

- **私密语义（文档约束）**：收藏/点赞网格本应仅主人可见。  
  **本期**：不实现「登录用户 === 主页所有者」判断，**默认始终允许展示网格**。  
  实现时在 Tab 切换或列表加载函数处注释：  
  `// TODO: 仅当 viewerId === profileOwnerId 时展示 favorites/likes 网格，否则空态或隐藏`

### 本期不做

- 鉴权后的空态/隐藏逻辑（仅 TODO）。
- 为锁单独做点击拦截（锁不是禁用）。

### 组件验收

- [ ] 三 Tab 可切换；收藏/点赞可见锁图标
- [ ] 活动态为浅灰底 pill，接近设计稿
- [ ] 源码含上述私密可见 TODO 注释（实现阶段）
