# 需求Spec：我的主页（Mine Profile）开发

> **渐进披露入口（主文件）**。Agent 流程：
> 1. 只读本文件 → 查「任务与进度」选 `todo`/`unknown`（或用户指定 id）
> 2. 按该行 `spec` 列只打开对应组件详述文件（需要编排时再读同目录 `_index.md`）
> 3. 实现后回写本文件任务行的 `status` / `files` / `notes`
>
> 详述目录：[`mine-profile/`](mine-profile/)
>
> **格式冻结**：本 slug 组件详述仍为旧单层（组成 / UI·Tailwind / 交互）。新全局约定为方案 C 双层（分析 + 实现契约），见 [`.specs/README.md`](../README.md)。实现可按旧层回退解读；升级须显式 `iterate`，勿批量改写。

## 目标描述

登录用户在「我」入口查看自己的主页：资料头（头像、身份徽章、统计、外链）、操作菜单，以及帖子 / 收藏 / 点赞三个内容 Tab 下的卡片网格。当前阶段以设计稿一致的前端 UI 与本地 Mock 闭环为目标。

## 技术约束

- 技术栈：Svelte 5、SvelteKit、TypeScript strict、Tailwind CSS v4、shadcn-svelte、lucide-svelte、Deno tasks（对齐根 `AGENTS.md`）。
- 页面入口：复用现有 App Header、桌面侧栏、移动底栏；路由落在既有 `/app/profile`（或经确认的等价入口）；**不改变**现有全局搜索框语义（设计稿中的「搜索我的帖子/收藏/赞」占位不作为本期实现）。
- 状态管理：页级 Svelte 5 runes/store 管理活动 Tab、菜单开闭与本地 Mock 列表；数据适配层与 UI 分离，便于后续替换 API。
- 编码规范：不得手改 `packages/web/src/lib/api/**`；触控目标不小于 44×44；文本输入必有 maxlength；禁止 `any` / `@ts-ignore`。
- UI 规格：组件详述优先 **Tailwind class**（`zinc-*` 中性色、`red-500` 主强调、支持 `dark:`）；读不清标「待澄清」。
- 交互规格：事件表 + 回调名；禁止只写「可点击」。
- 私密 Tab（收藏 / 点赞锁图标）：语义为「仅当登录用户与主页所有者为同一人时可展示网格」；**本期不实现鉴权**，默认始终展示网格，并在应对逻辑处留 `TODO` 注释。
- 本期不实现：修改昵称 / 身份认证 / 编辑徽章 / 编辑个人链接的真实弹窗与提交流程（仅菜单占位）；真实分享、关注/粉丝跳转、外链跳转、帖子详情路由、真实个人资料 API。相应交互须占位反馈或 TODO，不得伪装成功。
- 设计真相源：[`.design/profile/mine-profile`](../../.design/profile/mine-profile)。
- 详述分片目录：[`.specs/profile/mine-profile/`](mine-profile/)
- 进度真相源：本文件「任务与进度」（不使用独立 `.tasks.md`）

## 功能需求索引

> 维度一：子需求 → `mine-profile/<area>/_index.md`  
> 维度二：组件 → `mine-profile/<area>/<component>.md`

- [页面 · 我的主页壳](mine-profile/page-shell/_index.md) — `profile.page.shell`
- [模块 · 资料头](mine-profile/profile-header/_index.md) — `profile.header`
- [模块 · 内容区](mine-profile/content/_index.md) — `profile.content`

## 任务与进度

> `status`: `todo` | `doing` | `done` | `blocked` | `unknown`  
> `spec` 列为组件详述路径（相对本文件）。实现时 **禁止** 一次性读入全部详述。

### 进度摘要

| 指标 | 值 |
|------|-----|
| 总计 | 9 |
| done | 9 |
| doing | 0 |
| todo | 0 |
| blocked | 0 |
| unknown | 0 |

## 页面 · 我的主页壳

- **area_spec**: [`mine-profile/page-shell/_index.md`](mine-profile/page-shell/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `profile.page.shell` | 我的主页路由壳与 App 布局接入 | done | `.design/profile/mine-profile/image.png` | [`shell.md`](mine-profile/page-shell/shell.md) | [`packages/web/src/routes/app/profile/+page.svelte`, `packages/web/src/routes/app/profile/+layout.svelte`, `packages/web/src/routes/app/profile/components/profile-shell.svelte`] | qa: [`mine-profile/qa/profile.page.shell.md`](mine-profile/qa/profile.page.shell.md) |

## 模块 · 资料头

- **area_spec**: [`mine-profile/profile-header/_index.md`](mine-profile/profile-header/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `profile.header` | 资料头编排与槽位 | done | `.design/profile/mine-profile/image.png` | [`header.md`](mine-profile/profile-header/header.md) | [`packages/web/src/routes/app/profile/components/header/profile-header.svelte`, `packages/web/src/routes/app/profile/components/types.ts`, `packages/web/src/routes/app/profile/components/mock-data.ts`] | qa: [`mine-profile/qa/profile.header.md`](mine-profile/qa/profile.header.md)；TEMP MOCK |
| `profile.header.identity` | 头像、昵称、徽章、标签与 QQ 号 | done | `.design/profile/mine-profile/image.png` | [`identity.md`](mine-profile/profile-header/identity.md) | [`packages/web/src/routes/app/profile/components/header/identity.svelte`] | qa: [`mine-profile/qa/profile.header.identity.md`](mine-profile/qa/profile.header.identity.md) |
| `profile.header.stats` | 关注 / 粉丝 / 获赞与收藏统计 | done | `.design/profile/mine-profile/image.png` | [`stats.md`](mine-profile/profile-header/stats.md) | [`packages/web/src/routes/app/profile/components/header/stats.svelte`] | qa: [`mine-profile/qa/profile.header.stats.md`](mine-profile/qa/profile.header.stats.md)；点击 → Toast「暂未开放」 |
| `profile.header.social-links` | 个人外链列表 | done | `.design/profile/mine-profile/image.png` | [`social-links.md`](mine-profile/profile-header/social-links.md) | [`packages/web/src/routes/app/profile/components/header/social-links.svelte`] | qa: [`mine-profile/qa/profile.header.social-links.md`](mine-profile/qa/profile.header.social-links.md)；点击 → Toast「暂未开放」 |
| `profile.header.action-menu` | 右上角 … 操作菜单 | done | `.design/profile/mine-profile/image.png` | [`action-menu.md`](mine-profile/profile-header/action-menu.md) | [`packages/web/src/routes/app/profile/components/header/action-menu.svelte`] | qa: [`mine-profile/qa/profile.header.action-menu.md`](mine-profile/qa/profile.header.action-menu.md)；分享=复制链接；其余暂未开放 |

## 模块 · 内容区

- **area_spec**: [`mine-profile/content/_index.md`](mine-profile/content/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `profile.content.tabs` | 帖子 / 收藏 / 点赞 Tab（含锁图标） | done | `.design/profile/mine-profile/image.png` | [`tabs.md`](mine-profile/content/tabs.md) | [`packages/web/src/routes/app/profile/components/content/content-tabs.svelte`] | qa: [`mine-profile/qa/profile.content.tabs.md`](mine-profile/qa/profile.content.tabs.md)；鉴权 TODO，默认始终展示网格 |
| `profile.content.grid` | 内容卡片网格 | done | `.design/profile/mine-profile/image.png` | [`grid.md`](mine-profile/content/grid.md) | [`packages/web/src/routes/app/profile/components/content/content-grid.svelte`] | qa: [`mine-profile/qa/profile.content.grid.md`](mine-profile/qa/profile.content.grid.md) |
| `profile.content.post-card` | 单张内容卡片 | done | `.design/profile/mine-profile/image.png` | [`post-card.md`](mine-profile/content/post-card.md) | [`packages/web/src/routes/app/profile/components/content/post-card.svelte`] | qa: [`mine-profile/qa/profile.content.post-card.md`](mine-profile/qa/profile.content.post-card.md)；点赞本地 Mock；打开帖子暂未开放 |

### 更新约定

1. 实现某任务后，更新本文件对应行的 `status`、`files`、`notes`；无法确认用 `unknown`。
2. 实现以该行 `spec` 指向的组件文件为准（组成 / UI·Tailwind / 交互·事件表+回调 / children / 组件验收）。
3. 需要跨组件编排时只追加阅读同 area 的 `_index.md`；子件按详述 `children` 按需下钻。
4. 范围变更用 `spec-tasklist-builder` iterate；不得在实现阶段改写详述中的功能需求与验收。
5. `packages/web/src/lib/api/**` 仅可引用；协议变化后从仓库根执行 `deno task gen:api`。

## 验收标准

- [x] `/app/profile`（或确认入口）在现有 App 壳内展示资料头 + 三 Tab + 内容网格，布局与 [`.design/profile/mine-profile/image.png`](../../.design/profile/mine-profile/image.png) 主内容区一致。
- [x] 资料头含头像、昵称、认证/社刊类徽章、多枚「WOTA 艺组」类标签、QQ 号文案、三项统计与外链行。
- [x] `…` 菜单含五项：分享主页、修改昵称、申请身份认证、编辑部门徽章、编辑个人链接；除可本地演示的分享占位外，其余为「暂未开放」类反馈 + TODO，不打开未收录的弹窗 Spec。
- [x] 三 Tab 可切换；收藏、点赞显示锁图标；本期默认始终展示网格，鉴权分支有 TODO。
- [x] 网格多列卡片：封面、标题、作者头像与昵称、点赞数；触控目标 ≥ 44×44；支持浅色/暗色。
- [x] 未改全局搜索语义；未手改 `packages/web/src/lib/api/**`。
- [x] 每个可开发组件均有独立详述（含 `children`），主文件任务表与详述 id 一一对应。
