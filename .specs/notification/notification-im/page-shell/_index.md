# 页面 · 通知中心壳

> 子需求编排（短）。组件详述见同目录文件。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `notification.page.shell`
- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **职责**: 在现有 App 壳内提供通知模块的五 Tab 容器、统一未读状态和桌面/窄屏布局。
- **子组件**:
  - [`notification.page.shell`](shell.md) — 通知中心路由壳
  - [`notification.page.shell.tabs`](tabs.md) — 五分类 Tab 条
  - [`notification.page.shell.unread-state`](unread-state.md) — 未读状态协调器
  - [`notification.page.shell.responsive`](responsive.md) — 响应式内容容器
- **编排交互**:
  1. `tabs` 的 `onTabChange(tabId)` → 切换内容面板，保留各 Tab 本地滚动位置。
  2. `unread-state` 向 `tabs` 提供 `unreadCounts`；打开会话或前三类互动 Tab 后本地清零并回写角标。
  3. `responsive` 根据断点决定消息 Tab 双栏或列表/详情切换；其他 Tab 单列。
- **复用关系**: 复用现有 App Header、导航与 `Badge`/`Button`；不得复制全局搜索逻辑。
