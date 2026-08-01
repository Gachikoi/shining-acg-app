# QA · `profile.header`

- **task_id**：`profile.header`
- **关联 spec**：`.specs/profile/mine-profile/profile-header/header.md`
- **入口**：`/app/profile`
- **Mock 依赖**：有数据 — `packages/web/src/routes/app/profile/components/mock-data.ts`（`TEMP MOCK`）

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 资料头编排

### 1. 功能点简介

资料头自上而下编排：身份区、统计、外链，右上角操作菜单。

### 2. 如何测试

1. 打开 `/app/profile`，对照设计稿观察资料头区域。
2. 确认头像/昵称/徽章/标签/QQ、三项统计、外链行、右上角 `…` 均出现。

### 3. 怎样算通过

- [ ] 身份、统计、外链、菜单均在同一资料头区块内
- [ ] 桌面与窄屏下菜单仍可触达（≥ 44×44）
- [ ] 浅色/暗色模式下文字与图标可读
