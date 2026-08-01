# Tab · 晒你通知

> 子需求编排（短）。组件详述见同目录文件。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `notification.tab.system`
- **设计源**: [`.design/notification/main/image.png`](../../../../.design/notification/main/image.png)
- **职责**: 保留系统通知入口，本期不实现列表。
- **子组件**:
  - [`notification.tab.system`](system.md) — 晒你通知 Tab 入口
  - [`notification.tab.system.placeholder`](placeholder.md) — 系统通知占位
- **编排交互**:
Tab 可选中；进入不自动清未读。
- **复用关系**: shared.state-feedback；后续可对齐 `V1SystemNotification`。
