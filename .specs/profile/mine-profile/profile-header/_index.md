# 模块 · 资料头

> 子需求编排（短）。组件详述见同目录或二级 `<module>/` 子目录。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `profile.header`
- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **职责**: 展示当前用户资料摘要，并提供操作菜单入口。
- **子组件**:
  - [`profile.header`](header.md) — 资料头编排
  - [`profile.header.identity`](identity.md) — 身份摘要
  - [`profile.header.stats`](stats.md) — 统计行
  - [`profile.header.social-links`](social-links.md) — 外链行
  - [`profile.header.action-menu`](action-menu.md) — 操作菜单
- **编排交互**:
  1. `action-menu` 的 `onOpenChange(open)` 控制菜单显隐；打开时仅此一层浮层。
  2. 菜单项回调上抛至页级；本期多数为占位 toast + TODO。
  3. `stats` / `social-links` 点击本期占位，不伪造成功跳转。
- **复用关系**: 徽章/标签可复用现有 user-badge 类组件；头像失败用占位。
