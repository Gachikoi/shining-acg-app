# `profile.header` — 资料头编排

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.page.shell`
- **子组件** (`children`):
  - [`profile.header.identity`](identity.md) — 身份摘要
  - [`profile.header.stats`](stats.md) — 统计行
  - [`profile.header.social-links`](social-links.md) — 外链行
  - [`profile.header.action-menu`](action-menu.md) — 操作菜单
- **职责**: 横向组织头像区、文案区与右上角操作菜单。

> Agent：本任务只读本文件；需要子件时再按 `children` 下钻。禁止一次展开整棵子树。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 左 | 大头像 | 见 identity |
| 中 | 昵称行 / 标签 / QQ / 统计 / 外链 | 纵向堆叠 |
| 右上 | `…` 触发器 + 菜单 | 见 action-menu |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `relative flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4` |
| 文案列 | `min-w-0 flex-1 flex flex-col gap-2` |
| 菜单锚点 | `absolute right-0 top-0` 或 `sm:static sm:ml-auto` |
| 触控 | 内部可点控件 ≥ `min-h-11 min-w-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | — | 编排容器；手势在子组件 | — |

### 状态

- 组合子组件本地/页级 props；无额外业务状态。

### 边界

- 窄屏：头像与文案可换行；菜单不遮挡关键文案可读性。

### 本期不做

- 编辑头像上传。

### 组件验收

- [ ] 头像、身份、统计、外链、菜单在同一资料头区域内按设计排列
- [ ] `children` 对应任务可分别挂载
