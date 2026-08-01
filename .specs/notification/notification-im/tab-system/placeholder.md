# `notification.tab.system.placeholder` — 系统通知占位

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.tab.system`
- **职责**: 「功能建设中」中性空态。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 空态 | 文案 | 功能建设中 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 文案 | `text-sm text-zinc-400 dark:text-zinc-500` |
| 布局 | 水平垂直居中 |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | — | 无业务手势 | — |

### 状态

- 无

### 边界

- 桌面/窄屏均居中。

### 本期不做

- 列表 UI。

### 组件验收

- [ ] 居中显示建设中文案
- [ ] 不阻塞切 Tab

### 共享组件 · 通知展示

- **id**: `notification.shared`
- **设计源**: [`.design/notification/comment/image.png`](../../../../.design/notification/comment/image.png)、[`.design/notification/like/image.png`](../../../../.design/notification/like/image.png)、[`.design/notification/follow/image.png`](../../../../.design/notification/follow/image.png)
- **职责**: 统一用户、目标预览与状态反馈。
- **子组件**:
  - `notification.shared`
  - `notification.shared.user-identity`
  - `notification.shared.target-preview`
  - `notification.shared.state-feedback`
- **编排交互**: 仅 props/事件，不直连请求；时间由适配层格式化。
- **复用关系**: 被各 Tab 引用，不承载业务状态。
