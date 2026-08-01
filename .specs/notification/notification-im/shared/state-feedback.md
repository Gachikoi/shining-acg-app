# `notification.shared.state-feedback` — 状态反馈

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.shared`
- **职责**: 空、加载、错误、重试、未接入与轻量成功。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 空 | EmptyState | 可复用现有 |
| 加载 | spinner/文案 | |
| 错误 | 文案 + 重试 | |
| 未接入 | toast/文案 | 「暂未接入」「暂未开放」 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 空态文案 | `text-sm text-zinc-400` |
| 错误文案 | `text-sm text-zinc-600 dark:text-zinc-300` |
| 重试按钮 | `min-h-11 rounded-full border border-zinc-300 px-4 text-sm` |
| 成功轻提示 | 现有 toast 模式（若有） |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键·重试 | 错误态 | 重试 | `onRetry()` |

### 状态

- `variant: 'empty' \| 'loading' \| 'error' \| 'unavailable' \| 'success'`

### 边界

- 暗色对比 ≥ 正文可读；不以假成功掩盖未接入。

### 本期不做

- 复杂骨架屏动画（可选）。

### 组件验收

- [ ] 覆盖空/载/错/未接入
- [ ] 重试可触发 `onRetry`
