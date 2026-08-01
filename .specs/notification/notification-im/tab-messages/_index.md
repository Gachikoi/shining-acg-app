# Tab · 我的消息

> 子需求编排（短）。组件详述见同目录文件。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `notification.tab.messages`
- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)、[`.design/notification/message/image.png`](../../../../.design/notification/message/image.png)
- **职责**: 展示会话列表和当前会话详情，完成本地消息浏览、菜单操作与输入发送闭环。
- **子组件**:
  - [`notification.tab.messages`](messages.md) — 我的消息 Tab 编排与 Mock 适配层
  - [`notification.tab.messages.conversation-list`](conversation-list.md) — 会话列表
  - [`notification.tab.messages.conversation-item`](conversation-item.md) — 会话项
  - [`notification.tab.messages.conversation-menu`](conversation-menu.md) — 会话右键/侧滑操作
  - [`notification.tab.messages.conversation-dialogs`](conversation-dialogs.md) — 举报/删除确认
  - [`notification.tab.messages.chat-panel`](chat-panel.md) — 会话详情面板
  - [`notification.tab.messages.chat-header`](chat-header.md) — 会话资料头
  - [`notification.tab.messages.message-list`](message-list.md) — 消息列表
  - [`notification.tab.messages.message-item`](message-item.md) — 消息项
  - [`notification.tab.messages.message-menu`](message-menu.md) — 消息操作浮窗
  - [`notification.tab.messages.composer`](composer.md) — 消息输入区
- **编排交互**:
  1. `conversation-item` `onSelectConversation` → 设当前会话、清未读、窄屏进详情。
  2. `conversation-menu` 举报/删除 → `conversation-dialogs`；置顶 → 列表重排。
  3. `message-menu` 引用 → `composer` 填入引用；撤回/编辑 → 本地更新消息。
  4. `composer` `onSendText` → `message-list` 追加并滚底。
  5. 同一时刻最多一个菜单或侧滑栏打开。
- **复用关系**: 头像/身份、时间、状态反馈用 `notification.shared.*`；弹窗用 shadcn `AlertDialog`。
