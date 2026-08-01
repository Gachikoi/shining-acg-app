# 共享组件 · 通知展示

> 子需求编排（短）。组件详述见同目录文件。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `notification.shared`
- **设计源**: [`.design/notification/comment/image.png`](../../../../.design/notification/comment/image.png)、[`.design/notification/like/image.png`](../../../../.design/notification/like/image.png)、[`.design/notification/follow/image.png`](../../../../.design/notification/follow/image.png)
- **职责**: 统一用户、目标预览与状态反馈。
- **子组件**:
  - [`notification.shared`](shared.md) — 共享出口与 typed props
  - [`notification.shared.user-identity`](user-identity.md) — 用户身份摘要
  - [`notification.shared.target-preview`](target-preview.md) — 通知目标预览
  - [`notification.shared.state-feedback`](state-feedback.md) — 状态反馈
- **编排交互**:
仅 props/事件，不直连请求；时间由适配层格式化。
- **复用关系**: 被各 Tab 引用，不承载业务状态。
