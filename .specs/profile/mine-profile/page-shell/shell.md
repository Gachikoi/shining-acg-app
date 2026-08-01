# `profile.page.shell` — 我的主页路由壳

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。  
> 落盘：`.specs/profile/mine-profile/page-shell/shell.md`

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.page.shell`
- **子组件** (`children`):
  - 无（资料头 / 内容区由页面组合挂载，分属其他 area 任务）
- **职责**: 在 `/app/profile` 提供满高主内容列，挂载资料头与内容区。

> Agent：本任务只读本文件；需要实现或接线某个子组件时，再按 `children` 链接向下打开对应详述（该子组件通常另有任务行）。禁止一次展开整棵子树。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 布局 | 主列 `flex flex-col` | 不破坏 App Header / 侧栏 / 底栏 |
| 上槽 | 资料头 | 挂载 `profile.header` |
| 下槽 | 内容区 | 挂载 `profile.content.*` |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex h-full min-h-0 w-full flex-col gap-6 overflow-y-auto px-4 py-4 md:px-6` |
| 背景 | 随 App 壳；主内容区 `bg-transparent` |
| 触控 | 壳本身不可点；内部控件 ≥ `min-h-11 min-w-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | — | 纯布局容器 | — |

### 状态

- 无独立业务状态。

### 边界

- 子内容为空时仍保持上下槽结构。
- 窄屏避免横向溢出（`overflow-x-hidden` 于页级可接受）。

### 本期不做

- 自定义顶栏/侧栏；改写全局搜索占位文案。

### 组件验收

- [ ] `/app/profile` 在 App 壳内可挂载资料头与内容区
- [ ] 未改动全局搜索语义
