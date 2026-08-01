# AGENTS.md — Shining ACG

仓库内所有 Agent 的**项目级开机页**：技术栈与架构向目录地图。  
不要创建 `packages/web/AGENTS.md`。

Spec 建清单 / 实现任务的流程不在本文件——激活对应 Skill：

| 意图 | Skill |
|------|--------|
| 从设计生成或迭代 Spec | `.cursor/skills/spec-tasklist-builder` |
| 按 Spec 实现恰好一个任务 | `.cursor/skills/implement-from-spec` |

---

## 1. 这是什么项目

Deno 管理的 **monorepo**：浏览器跑 `packages/web`，数据请求打到 `packages/server`（Go），持久化在 PostgreSQL，媒体在 MinIO。

| 目录 | 职责 |
|------|------|
| `packages/web` | SvelteKit 前端（日常主战场） |
| `packages/server` | Go 后端：Connect/HTTP API、业务、数据库 |
| `packages/android` / `ios` / `harmonyos` | 各端壳，一般可先忽略 |
| `scripts/` | 仓库级工具（含 `gen:api`） |
| `docs/` | 人读文档 |
| `.specs/` | Spec 工作流产物（随仓库） |
| `.design/` | 设计真相源（随仓库） |
| `.cursor/` | Skills / Rules（随仓库） |

域名与路由：`hooks.ts` 将 `app.*` reroute 到 `/app`，将 `www`/apex reroute 到 `/site`（同一 SPA 两套站点）。

---

## 2. 顶层目录

```text
shining-acg-app/
├── AGENTS.md
├── packages/
│   ├── web/
│   ├── server/
│   ├── android/ | ios/ | harmonyos/
├── scripts/                  # api 生成、git hooks
├── docs/
├── .specs/                   # Spec 主文件与分片
├── .design/                  # 设计真相源
├── .cursor/                  # Skills / Rules
├── deno.json                 # 仓库任务（如 gen:api）
└── README.md
```

---

## 3. 技术栈速览

**Web（`packages/web`）**

- Svelte 5 + SvelteKit + TypeScript strict
- Tailwind CSS v4、shadcn-svelte、lucide-svelte
- 任务与依赖用 Deno；API 客户端生成在 `src/lib/api/**`（只引用、不手改）

**Server（`packages/server`）**

- Go + Connect-Go（HTTP/JSON 为主）
- 合同：`proto/` → Buf；分层：service → biz → repo → model
- PostgreSQL、MinIO、Docker Compose

**仓库级**

- 根目录 Deno；协议变更后：`deno task gen:api`

---

## 4. 前端目录地图（`packages/web`）

### 4.1 源码骨架

```text
packages/web/src/
├── hooks.ts                 # 域名 → /app | /site
├── hey-api.svelte.ts        # Axios / Token / API baseURL
├── routes/                  # 页面（SvelteKit 文件路由）
│   ├── app/                 # App 站
│   ├── site/                # 官网
│   └── login-helper/        # 登录辅助页
└── lib/                     # 跨页面复用
    ├── api/                 # 生成的 API 客户端（勿手改）
    ├── components/
    │   ├── ui/              # shadcn 基础件
    │   └── custom/          # 业务可复用组件（瀑布流、帖子详情等）
    ├── stores/              # 跨页状态（如 feed、release）
    ├── modules/             # 能力模块（cache、gesture、device…）
    └── constants.ts         # 域名、BusinessIds 等
```

### 4.2 页面 → 目录（App）

路径均相对 `packages/web/src/routes/`。页面专有组件常放在同路由下的 `components/`。

| 用户感知 | URL（逻辑） | 目录 |
|----------|-------------|------|
| 首页 Feed | `/app/home` | `app/home/` |
| 发帖 / 发布 | `/app/release` | `app/release/` |
| 通知中心 | `/app/notification` | `app/notification/`（含 `components/`：messages、各 Tab） |
| 个人主页 | `/app/profile` | `app/profile/`（含 `components/`：header、content） |
| 管理后台入口 | `/app/management` | `app/management/` |
| 管理·分区/举报/权限等 | `/app/management/*` | `app/management/<子页>/` |
| 官网 | `/site` | `site/` |

调试页示例：`app/home/post-detail-debug/`、`app/release/media-upload-debug/`。

### 4.3 常见「功能」落在哪

| 功能 | 优先看 |
|------|--------|
| 首页瀑布流 / Feed 状态 | `lib/stores/feed/` + `lib/components/custom/waterfall/`、`feed-list/`、`feed-container/`；页面编排在 `routes/app/home/` |
| 帖子详情 / 评论区 | `lib/components/custom/post-detail/`、`comment-section/` |
| 富文本编辑 | `lib/components/custom/shin-rich/` |
| 发布流状态 | `lib/stores/release/` + `routes/app/release/` |
| 通知 IM UI | `routes/app/notification/components/`（多仍为页面内 Mock） |
| 调后端接口 | `import { … } from '$lib/api'`（生成物） |

---

## 5. 后端目录地图（`packages/server`）

```text
packages/server/
├── cmd/                      # 入口、Wire、注册哪些 Service（app.go）
├── proto/api/                # 接口合同（改协议从这里）
│   ├── main/
│   │   ├── feed/v1/          # 内容流 GET /v1/feed
│   │   ├── post/v1/
│   │   ├── user/v1/
│   │   ├── auth/v1/
│   │   ├── comment/v1/
│   │   ├── notification/v1/
│   │   └── …                # partition、report、department…
│   └── media/v1/
├── gen/                      # Buf 生成 Go（勿手改）
├── internal/
│   ├── service/              # Connect Handler（薄）
│   ├── repo/                 # 仓储 / DB
│   └── model/                # GORM 表（如 post.go）
├── config.yaml
└── docker-compose.yml        # 本地 Postgres / MinIO 等
```

前端生成的 TypeScript 客户端对应落在 `packages/web/src/lib/api/`；Swagger 在 `packages/web/swagger.swagger.json`。

---

## 6. Spec 与设计（本机工作流）

```text
.design/<area>/...            # 设计源
.specs/<area>/<slug>.spec.md  # 主 Spec（任务与进度）
.specs/<area>/<slug>/         # 分片详述、qa/
```

目录约定见 `.specs/README.md`；执行流程见上述两个 Skill。
