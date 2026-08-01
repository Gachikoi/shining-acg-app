# 模块 · 内容区

> 子需求编排（短）。组件详述见同目录或二级 `<module>/` 子目录。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `profile.content`
- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **职责**: 在资料头下方提供帖子 / 收藏 / 点赞切换与卡片网格。
- **子组件**:
  - [`profile.content.tabs`](tabs.md) — 内容 Tab
  - [`profile.content.grid`](grid.md) — 内容网格
  - [`profile.content.post-card`](post-card.md) — 内容卡片
- **编排交互**:
  1. `tabs` 的 `onTabChange(tabId)` → 切换网格数据源（本地 Mock）。
  2. 收藏 / 点赞带锁：语义为仅主人可见；**本期不鉴权**，默认始终渲染网格，在切换/加载处留 TODO。
  3. `post-card` 的 `onOpenPost` / `onToggleLike` 本期占位 + TODO。
- **复用关系**: 空态可用通知模块同类 `StateFeedback` 思路，或页内简单空文案；不强制跨包依赖。
