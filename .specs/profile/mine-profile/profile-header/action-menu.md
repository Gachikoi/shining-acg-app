# `profile.header.action-menu` — 操作菜单

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.header`
- **子组件** (`children`):
  - 无
- **职责**: 右上角 `…` 触发下拉，提供五项个人操作入口（本期多为占位）。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 触发器 | `…` 按钮 | 圆形/轻量按钮 |
| 菜单 | 五项 | 分享主页、修改昵称、申请身份认证、编辑部门徽章、编辑个人链接；可带左侧图标 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 触发器 | `inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800` |
| 面板 | `z-50 min-w-48 rounded-xl border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900` |
| 菜单项 | `flex min-h-11 w-full items-center gap-2 px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800` |
| 触控 | 触发器与每项 ≥ `min-h-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键·触发器 | 关闭时 | 打开菜单 | `onOpenChange(true)` |
| 左键·触发器 | 打开时 | 关闭 | `onOpenChange(false)` |
| 左键·菜单项 | — | 关闭菜单并上抛 | `onAction(actionId)`；见下表 |
| Esc | 打开 | 关闭 | `onOpenChange(false)` |
| 点击外部 | 打开 | 关闭 | `onOpenChange(false)` |
| ArrowUp / ArrowDown | 打开且聚焦菜单 | 移动焦点 | — |

**`actionId` 与本期行为**

| actionId | 文案 | 本期行为 |
|----------|------|----------|
| `share` | 分享主页 | 可本地 toast「已复制链接」或「暂未开放」+ TODO（二选一须在实现 notes 写明） |
| `editNickname` | 修改昵称 | toast「暂未开放」+ TODO（弹窗见 sibling 设计，不在本 Spec） |
| `applyIdentity` | 申请身份认证 | 同上 |
| `editDeptBadge` | 编辑部门徽章 | 同上 |
| `editSocialLinks` | 编辑个人链接 | 同上 |

### 状态

- `open: boolean`（`$bindable` 或受控）

### 边界

- 同时只开一层菜单。
- 暗色下边框/背景可读。

### 本期不做

- 真实弹窗 UI（`modify-nickname-dialog` / `identity-auth-modal` 等）；剪贴板权限失败时需有失败提示若做分享。

### 组件验收

- [ ] 五项文案齐全且可键盘关闭
- [ ] 非分享项不打开未收录弹窗，仅占位 + TODO
