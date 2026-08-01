# `notification.tab.new-follow` — 新增关注 Tab 编排

- **设计源**: [`.design/notification/follow/image.png`](../../../../.design/notification/follow/image.png)
- **父节点**: `notification.tab.new-follow`
- **职责**: 列表、已读与关系状态编排。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 列表 | item | |
| 状态 | empty/loading/error | |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 面板 | `h-full overflow-y-auto`；`id="notification-panel-new-follow"` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | Tab 激活 | 本地已读 | `onTabMarkedRead('new-follow')` |
| — | 子项私信 | 切 Tab + 会话 | `onStartDm(userId)`（父编排） |

### 状态

- `items` / 关系 map

### 边界

- 已有会话不得重复创建。

### 本期不做

- 真实关系 API。

### 组件验收

- [ ] 打开 Tab 本地已读
- [ ] 私信编排可切到消息 Tab
