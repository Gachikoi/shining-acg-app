# 需求Spec：通知中心与 IM 模块开发

> **渐进披露入口（主文件）**。Agent 流程：
> 1. 只读本文件 → 查「任务与进度」选 `todo`/`unknown`（或用户指定 id）
> 2. 按该行 `spec` 列只打开对应组件详述文件（需要编排时再读同目录 `_index.md`）
> 3. 实现后回写本文件任务行的 `status` / `files` / `notes`
>
> 详述目录：[`notification-im/`](notification-im/)
>
> **格式冻结**：本 slug 组件详述仍为旧单层（组成 / UI·Tailwind / 交互）。新全局约定为方案 C 双层（分析 + 实现契约），见 [`.specs/README.md`](../README.md)。实现可按旧层回退解读；升级须显式 `iterate`，勿批量改写。

## 目标描述

登录用户在通知中心通过“我的消息、评论和@、赞和收藏、新增关注、晒你通知”五个 Tab 查看互动通知，并在“我的消息”内完成会话选择、消息浏览与本地交互。当前阶段以设计稿一致的前端 UI 和本地状态闭环为目标；真实 IM API、WebSocket、媒体上传、语音能力及通知目标跳转只预留契约。

## 技术约束

- 技术栈：Svelte 5、SvelteKit、TypeScript strict、Tailwind CSS v4、shadcn-svelte、lucide-svelte、Deno tasks（对齐根 `AGENTS.md`）。
- 页面入口：复用现有 `packages/web/src/routes/app/notification/+page.svelte` 与 App 级 Header、桌面侧栏、移动底栏；不改变现有全局搜索框语义。
- 状态管理：本期使用通知页级 Svelte 5 runes/store 管理活动 Tab、未读数、会话、消息、菜单与确认弹窗状态；数据适配层须与 UI 分离，便于后续替换为 API/WebSocket。
- 数据范围：评论和@、赞和收藏、新增关注可引用现有生成类型与 SDK；“我的消息”暂无已确认的后端契约，须使用独立本地类型/Mock，不得臆造或手改生成客户端。
- 编码规范：不得手改 `packages/web/src/lib/api/**`；触控目标不小于 44×44；文本输入 `maxlength=1000`；Svelte 组件不得使用 `any` 或 `@ts-ignore`。
- UI 规格：组件节点优先使用 **Tailwind class** 描述颜色、字号、圆角、间距；读不清设计稿时标「待澄清」，禁止猜测写入。项目中性色用 `zinc-*`，主强调用 `red-500`，并支持 `dark:`。
- 交互规格：组件节点使用 **事件表 + 回调名**；禁止只写「可点击」。
- 响应式：桌面使用“会话列表 + 会话详情”双栏；窄屏使用列表与详情单页切换，详情提供返回入口，不允许横向溢出。
- 本期不实现：真实 IM 收发、WebSocket 在线状态、上传、录音、语音通话、通知目标路由跳转及晒你系统通知列表。相应交互须给出占位反馈或 TODO 注释，不得伪装成功。
- 设计真相源：[`.design/notification`](../../.design/notification)。
- 详述分片目录：[`.specs/notification/notification-im/`](notification-im/)
- 进度真相源：本文件「任务与进度」（不再使用独立 `.tasks.md`）

## 功能需求索引

> 维度一：子需求（页面/Tab）→ `notification-im/<area>/_index.md`  
> 维度二：子功能/组件 → `notification-im/<area>/<component>.md`

- [页面 · 通知中心壳](notification-im/page-shell/_index.md) — `notification.page.shell`
- [Tab · 我的消息](notification-im/tab-messages/_index.md) — `notification.tab.messages`
- [Tab · 评论和@](notification-im/tab-comment-mention/_index.md) — `notification.tab.comment-mention`
- [Tab · 赞和收藏](notification-im/tab-like-collect/_index.md) — `notification.tab.like-collect`
- [Tab · 新增关注](notification-im/tab-new-follow/_index.md) — `notification.tab.new-follow`
- [Tab · 晒你通知](notification-im/tab-system/_index.md) — `notification.tab.system`
- [共享组件 · 通知展示](notification-im/shared/_index.md) — `notification.shared`

## 任务与进度

> `status`: `todo` | `doing` | `done` | `blocked` | `unknown`  
> `spec` 列为组件详述路径（相对本文件）。实现时 **禁止** 一次性读入全部详述。

### 进度摘要

| 指标 | 值 |
|------|-----|
| 总计 | 27 |
| done | 0 |
| doing | 0 |
| todo | 27 |
| blocked | 0 |
| unknown | 0 |

## 页面 · 通知中心壳

- **area_spec**: [`notification-im/page-shell/_index.md`](notification-im/page-shell/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `notification.page.shell` | 通知中心路由壳与现有 App 布局接入 | todo | `.design/notification/main/image.png` | [`shell.md`](notification-im/page-shell/shell.md) | [] | |
| `notification.page.shell.tabs` | 五分类 Tab、活动态与数量角标 | todo | `.design/notification/main/image.png` | [`tabs.md`](notification-im/page-shell/tabs.md) | [] | |
| `notification.page.shell.unread-state` | 页级未读聚合与本地已读联动 | todo | `.design/notification/main/image.png` | [`unread-state.md`](notification-im/page-shell/unread-state.md) | [] | |
| `notification.page.shell.responsive` | 桌面双栏与窄屏单页切换容器 | todo | `.design/notification/message/image.png` | [`responsive.md`](notification-im/page-shell/responsive.md) | [] | |

## Tab · 我的消息

- **area_spec**: [`notification-im/tab-messages/_index.md`](notification-im/tab-messages/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `notification.tab.messages` | 我的消息 Tab 状态编排与 Mock 适配层 | todo | `.design/notification/main/image.png` | [`messages.md`](notification-im/tab-messages/messages.md) | [] | |
| `notification.tab.messages.conversation-list` | 会话列表、排序与空态 | todo | `.design/notification/main/image.png` | [`conversation-list.md`](notification-im/tab-messages/conversation-list.md) | [] | |
| `notification.tab.messages.conversation-item` | 会话头像、摘要、时间及在线/未读状态 | todo | `.design/notification/main/image.png` | [`conversation-item.md`](notification-im/tab-messages/conversation-item.md) | [] | |
| `notification.tab.messages.conversation-menu` | 会话右键菜单与触屏侧滑操作栏 | todo | `.design/notification/message/image.png` | [`conversation-menu.md`](notification-im/tab-messages/conversation-menu.md) | [] | |
| `notification.tab.messages.conversation-dialogs` | 举报/删除二次确认与本地反馈 | todo | `.design/notification/main/image.png` | [`conversation-dialogs.md`](notification-im/tab-messages/conversation-dialogs.md) | [] | |
| `notification.tab.messages.chat-panel` | 会话详情面板与空会话状态 | todo | `.design/notification/message/image.png` | [`chat-panel.md`](notification-im/tab-messages/chat-panel.md) | [] | |
| `notification.tab.messages.chat-header` | 用户资料头、关注、局部搜索和菜单 | todo | `.design/notification/message/image.png` | [`chat-header.md`](notification-im/tab-messages/chat-header.md) | [] | |
| `notification.tab.messages.message-list` | 收发消息列表、滚动锚点与方向样式 | todo | `.design/notification/message/image.png` | [`message-list.md`](notification-im/tab-messages/message-list.md) | [] | |
| `notification.tab.messages.message-item` | 文本/图片/引用消息与发送状态 | todo | `.design/notification/message/image.png` | [`message-item.md`](notification-im/tab-messages/message-item.md) | [] | |
| `notification.tab.messages.message-menu` | 复制、引用、撤回、编辑消息浮窗 | todo | `.design/notification/message/image.png` | [`message-menu.md`](notification-im/tab-messages/message-menu.md) | [] | |
| `notification.tab.messages.composer` | 文本、语音输入、图片、语音通话和发送区 | todo | `.design/notification/message/image.png` | [`composer.md`](notification-im/tab-messages/composer.md) | [] | |

## Tab · 评论和@

- **area_spec**: [`notification-im/tab-comment-mention/_index.md`](notification-im/tab-comment-mention/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `notification.tab.comment-mention` | 评论和@ Tab 列表、已读与状态编排 | todo | `.design/notification/comment/image.png` | [`comment-mention.md`](notification-im/tab-comment-mention/comment-mention.md) | [] | |
| `notification.tab.comment-mention.item` | 四类评论/@通知项 | todo | `.design/notification/comment/image.png` | [`item.md`](notification-im/tab-comment-mention/item.md) | [] | |

## Tab · 赞和收藏

- **area_spec**: [`notification-im/tab-like-collect/_index.md`](notification-im/tab-like-collect/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `notification.tab.like-collect` | 赞和收藏 Tab 列表、已读与状态编排 | todo | `.design/notification/like/image.png` | [`like-collect.md`](notification-im/tab-like-collect/like-collect.md) | [] | |
| `notification.tab.like-collect.item` | 三类赞/收藏通知项 | todo | `.design/notification/like/image.png` | [`item.md`](notification-im/tab-like-collect/item.md) | [] | |

## Tab · 新增关注

- **area_spec**: [`notification-im/tab-new-follow/_index.md`](notification-im/tab-new-follow/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `notification.tab.new-follow` | 新增关注 Tab 列表、已读与关系状态编排 | todo | `.design/notification/follow/image.png` | [`new-follow.md`](notification-im/tab-new-follow/new-follow.md) | [] | |
| `notification.tab.new-follow.item` | 用户身份、私信与回关通知项 | todo | `.design/notification/follow/image.png` | [`item.md`](notification-im/tab-new-follow/item.md) | [] | |

## Tab · 晒你通知

- **area_spec**: [`notification-im/tab-system/_index.md`](notification-im/tab-system/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `notification.tab.system` | 晒你通知 Tab 入口与状态边界 | todo | `.design/notification/main/image.png` | [`system.md`](notification-im/tab-system/system.md) | [] | |
| `notification.tab.system.placeholder` | “功能建设中”占位页 | todo | `.design/notification/main/image.png` | [`placeholder.md`](notification-im/tab-system/placeholder.md) | [] | |

## 共享组件 · 通知展示

- **area_spec**: [`notification-im/shared/_index.md`](notification-im/shared/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `notification.shared` | 共享通知展示组件出口与 typed props | todo | `.design/notification/comment/image.png` | [`shared.md`](notification-im/shared/shared.md) | [] | |
| `notification.shared.user-identity` | 头像、在线点、昵称、认证与标签摘要 | todo | `.design/notification/follow/image.png` | [`user-identity.md`](notification-im/shared/user-identity.md) | [] | |
| `notification.shared.target-preview` | 帖子缩略图与评论引用预览 | todo | `.design/notification/comment/image.png` | [`target-preview.md`](notification-im/shared/target-preview.md) | [] | |
| `notification.shared.state-feedback` | 空、加载、错误、重试与未接入反馈 | todo | `.design/notification/main/image.png` | [`state-feedback.md`](notification-im/shared/state-feedback.md) | [] | |

### 更新约定

1. 实现某任务后，更新本文件对应行的 `status`、`files`、`notes`；无法确认用 `unknown`。
2. 实现以该行 `spec` 指向的组件文件为准（组成 / UI·Tailwind / 交互·事件表+回调 / 组件验收）。
3. 需要跨组件编排时只追加阅读同 area 的 `_index.md`，不要加载其他 area。
4. 范围变更用 `spec-tasklist-builder` iterate；不得在实现阶段改写详述中的功能需求与验收。
5. `packages/web/src/lib/api/**` 仅可引用；协议变化后从仓库根执行 `deno task gen:api`。

## 验收标准

- [ ] 页面固定展示五个 Tab，名称依次为“我的消息、评论和@、赞和收藏、新增关注、晒你通知”，活动态、分类色和数量角标与对应设计稿及本 Spec UI 表一致。
- [ ] 打开会话或前三类互动通知 Tab 后，本地未读状态和角标同步更新；数量超过 99 显示 `99+`，系统通知占位不产生假已读。
- [ ] 桌面“我的消息”为会话列表与详情双栏，窄屏可在列表和详情间无横向溢出地往返。
- [ ] 会话项正确展示在线绿点、未读红点、静音、时间与选中态；桌面右键和触屏侧滑均提供“举报、置顶/取消置顶、删除”。
- [ ] 举报与删除有二次确认；置顶切换更新排序；删除当前会话后回到稳定空态或下一可用会话。
- [ ] 会话头展示头像、ID/昵称、身份表情/标签、个性签名、关注、会话内搜索和菜单入口，窄屏另有返回入口。
- [ ] 消息列表区分收/发方向；消息右键或长按可按能力执行复制、引用、撤回、编辑的本地交互。
- [ ] 输入区含文本、语音输入、图片、语音通话和发送入口；文本上限 1000，空白不可发送，Enter/Shift+Enter 行为明确。
- [ ] 评论和@覆盖四类动作；赞和收藏覆盖三类动作；新增关注可私信进入会话并本地回关。
- [ ] 评论/赞收藏项点击仅给出“暂未开放”反馈并保留目标跳转 TODO，不实现或伪造关联帖子定位。
- [ ] “晒你通知”可切换并展示占位，不发起未要求的系统通知实现。
- [ ] 所有交互控件支持键盘操作与可访问名称，触控目标不小于 44×44；浅色、暗色和窄屏下均可读。
- [ ] 空、加载、错误、图片失败及未接入能力有明确反馈，不以假成功掩盖缺失 API/WebSocket/上传/语音能力。
- [ ] 每个可开发组件均有独立详述文件，且含组成 / UI（Tailwind）/ 交互（事件表 + 回调名）/ 状态 / 边界 / 本期不做 / 组件验收。
- [ ] 每个页面、Tab 和组件节点均可追溯到 `.design/notification/**/image.png`。
- [ ] 本主 Spec 任务表与 `notification-im/**` 详述文件 id 一一对应。
