# `notification.tab.messages.conversation-dialogs` — 举报/删除确认

- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 二次确认后执行本地举报成功提示或移除会话。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 弹窗 | AlertDialog | 标题、说明、取消、确认 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 确认危险操作 | 确认按钮 `bg-red-500 text-white hover:bg-red-600` |
| 取消 | 次要按钮，zinc 边框/文本 |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 确认举报 | 弹窗开 | 本地成功反馈 + TODO 注释 | `onConfirmReport(conversationId)` |
| 确认删除 | 弹窗开 | 本地移除会话 | `onConfirmDelete(conversationId)` |
| 取消 / Esc | 弹窗开 | 关闭不改数据 | `onCancelDialog()` |

### 状态

- `dialog: 'report' \| 'delete' \| null` + target id

### 边界

- 删除当前会话后选中下一可用或空态；禁止假成功对接未实现 API。

### 本期不做

- 真实提交接口。

### 组件验收

- [ ] 举报/删除均有二次确认
- [ ] 确认删除后列表更新且详情态稳定
