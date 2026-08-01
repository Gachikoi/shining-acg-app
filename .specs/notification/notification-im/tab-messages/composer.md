# `notification.tab.messages.composer` — 消息输入区

- **设计源**: [`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **父节点**: `notification.tab.messages`
- **职责**: 文本发送与语音/图片/通话入口占位。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 工具 | 语音输入 / 图片 / 语音通话 | 图标按钮 |
| 输入 | textarea | `maxlength=1000` |
| 发送 | 按钮 | |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 容器 | `flex items-end gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800` |
| 工具钮 | `inline-flex size-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100` |
| 输入 | `min-h-11 flex-1 resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900` |
| 发送 | `min-h-11 rounded-full bg-red-500 px-4 text-sm font-medium text-white disabled:opacity-40` |
| 触控 | 所有可点 ≥ `min-h-11 min-w-11` |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键·发送 | 非空白 | 本地发送 | `onSendText(text)` |
| Enter | 非空白且非 IME 合成 | 发送 | `onSendText(text)` |
| Shift+Enter | — | 换行 | — |
| 左键·语音输入 | — | 「暂未接入」反馈 | `onVoiceInputPlaceholder()` |
| 左键·图片 | — | 本地选择预览；上传 TODO | `onPickImageLocal()` |
| 左键·通话 | — | 「暂未接入」反馈 | `onVoiceCallPlaceholder()` |

### 状态

- `draft` / `quote` / `sending`

### 边界

- 空白（trim 后空）禁用发送；超长被 maxlength 截断；不得请求麦克风权限伪装成功。

### 本期不做

- 真实上传、录音、通话。

### 组件验收

- [ ] `maxlength=1000`；空白不可发送
- [ ] Enter / Shift+Enter 行为正确
- [ ] 语音输入与通话仅占位反馈

### Tab · 评论和@

- **id**: `notification.tab.comment-mention`
- **设计源**: [`.design/notification/comment/image.png`](../../../../.design/notification/comment/image.png)
- **职责**: 单列展示四类互动通知。
- **子组件**:
  - `notification.tab.comment-mention`
  - `notification.tab.comment-mention.item`
- **编排交互**:
  1. Tab 打开 → `onTabMarkedRead('comment-mention')`。
  2. 项点击 → 本期 `onOpenNotificationTarget` 仅「暂未开放」+ TODO。
- **复用关系**: 形状对齐 `V1CommentMentionNotification`；复用 shared 用户/预览/状态。
