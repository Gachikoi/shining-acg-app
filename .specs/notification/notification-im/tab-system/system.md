# `notification.tab.system` — 晒你通知 Tab 入口

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.tab.system`
- **职责**: Tab 面板边界；不请求系统通知列表。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 面板 | placeholder | |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 面板 | `flex h-full items-center justify-center`；`id="notification-panel-system"` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | Tab 激活 | 仅展示占位，不清未读 | — |

### 状态

- 无列表状态

### 边界

- 可随时切回其他 Tab。

### 本期不做

- 系统通知列表与已读。

### 组件验收

- [ ] 可切换进入且不自动清系统未读
- [ ] 不发起系统通知请求
