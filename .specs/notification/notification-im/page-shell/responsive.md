# `notification.page.shell.responsive` — 响应式内容容器

- **设计源**: [`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **父节点**: `notification.page.shell`
- **职责**: 桌面容纳消息双栏；窄屏在会话列表与详情间切换；其他 Tab 单列。

### 组成

| 区域 | 元素 | 说明 |
|------|------|------|
| 桌面 | 左列表 + 右详情 | 消息 Tab |
| 窄屏 | 列表页 / 详情页互斥 | 详情含返回 |
| 其他 Tab | 单列滚动 | 全宽 |

### UI

| 属性 | 规格（Tailwind / 行为） |
|------|-------------------------|
| 双栏容器 | `flex h-full min-h-0`；左栏约 `w-[min(100%,22rem)]` 或 `basis-[35%]`，右栏 `flex-1` |
| 分割线 | `border-r border-zinc-100 dark:border-zinc-800` |
| 窄屏 | 单栏 `w-full`；禁止横向溢出 `overflow-x-hidden` |
| 断点 | 待与现有 App 布局对齐；建议 `md:` 起双栏（若冲突标实现时对照代码） |

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| — | 窄屏选中会话 | 切到详情视图 | `onShowChatDetail(true)` |
| 返回 | 窄屏详情 | 回到列表 | `onShowChatDetail(false)` / `onBackToList()` |

### 状态

- `isNarrow`（或媒体查询派生）
- `showChatDetail`（窄屏）

### 边界

- 切换断点时保持 `activeTab` 与当前会话 id；不得出现横向滚动条。

### 本期不做

- 可拖拽调整栏宽。

### 组件验收

- [ ] 桌面消息 Tab 双栏无横向溢出
- [ ] 窄屏可列表 ↔ 详情往返且保留 Tab

### Tab · 我的消息

- **id**: `notification.tab.messages`
- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)、[`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **职责**: 展示会话列表和当前会话详情，完成本地消息浏览、菜单操作与输入发送闭环。
- **子组件**:
  - `notification.tab.messages`
  - `notification.tab.messages.conversation-list`
  - `notification.tab.messages.conversation-item`
  - `notification.tab.messages.conversation-menu`
  - `notification.tab.messages.conversation-dialogs`
  - `notification.tab.messages.chat-panel`
  - `notification.tab.messages.chat-header`
  - `notification.tab.messages.message-list`
  - `notification.tab.messages.message-item`
  - `notification.tab.messages.message-menu`
  - `notification.tab.messages.composer`
- **编排交互**:
  1. `conversation-item` `onSelectConversation` → 设当前会话、清未读、窄屏进详情。
  2. `conversation-menu` 举报/删除 → `conversation-dialogs`；置顶 → 列表重排。
  3. `message-menu` 引用 → `composer` 填入引用；撤回/编辑 → 本地更新消息。
  4. `composer` `onSendText` → `message-list` 追加并滚底。
  5. 同一时刻最多一个菜单或侧滑栏打开。
- **复用关系**: 头像/身份、时间、状态反馈用 `notification.shared.*`；弹窗用 shadcn `AlertDialog`。
