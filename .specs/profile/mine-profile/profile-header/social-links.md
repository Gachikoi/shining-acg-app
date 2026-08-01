# `profile.header.social-links` — 外链行

> 单组件详述文件。UI 用 Tailwind class；交互用事件表 + 回调名。

- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **父节点**: `profile.header`
- **子组件** (`children`):
  - 无
- **职责**: 展示个人外链（哔哩哔哩、Github、小红书等）。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 链接行 | 文本链 | 蓝色字重，横向排列 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex flex-wrap items-center gap-3` |
| 链接 | `text-sm font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400` |
| 触控 | 每链 ≥ `min-h-11` 可点热区（可用 `inline-flex items-center py-2`） |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键单击 | — | 占位（不强制 `window.open`） | `onSocialClick(linkId)` → toast「暂未开放」+ TODO |
| Enter / Space | 聚焦时 | 同左键 | 同上 |

### 状态

- props：`links: { id, label, href? }[]`

### 边界

- 空列表不渲染容器。
- 本期即使有 `href` 也不直接外跳（避免未评审外链）；统一走回调占位。

### 本期不做

- 真实外链跳转与链接编辑器（见菜单「编辑个人链接」）。

### 组件验收

- [ ] 设计稿三类链接文案可 Mock 展示
- [ ] 点击为占位反馈
