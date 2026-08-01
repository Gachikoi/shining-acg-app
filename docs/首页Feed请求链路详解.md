# 首页 Feed 请求链路详解（给前端）

> 用首页帖子信息流举例，说明本仓库前后端怎么协作、打开页面会打什么接口、后端收到后怎么取数再返回。  
> 前置速览见 [`前端工程师看后端.md`](./前端工程师看后端.md)。

---

## 0. 先说结论（读这一段就够）

| 问题 | 答案 |
|------|------|
| 打开首页会请求什么？ | **设计上**是 `GET /v1/feed`（可选再要分类列表 `GET /v1/feed/categories`） |
| 现在前端实际打了吗？ | **没有打到真实后端**。首页帖子流走的是本地 **Mock**（`mockFetchFeed`），真实客户端函数已生成但被注释掉 |
| 后端有没有 Feed 实现？ | Proto 合同有了，**还没注册 / 没写 Handler**。当前后端只挂了 Auth、User、Resource |
| 数据最终存在哪？ | 帖子表在 **PostgreSQL**（`posts` 等）；封面图等文件在 **MinIO**。前端永不直连库 |

所以：下面画的「完整链路」是 **本项目约定的目标架构**；首页 Feed **前端 UI + 类型 + 客户端已就绪，后端实现与接线尚未完成**，当前用 Mock 顶着开发。

---

## 1. 大图：浏览器到数据库

```text
┌─────────────────────────────────────────────────────────────────┐
│  浏览器  packages/web (:5173)                                    │
│                                                                  │
│  /app/home  →  FeedStore  →  feed-api.ts                         │
│       │              │                                           │
│       │              ├─ 现状：mockFetchFeed（本地造数据）          │
│       │              └─ 目标：feedServiceGetFeed（$lib/api）      │
│       │                         │                                │
│       │                         ▼                                │
│       │              hey-api.svelte.ts（Axios + Bearer Token）     │
│       │                         │                                │
│       │                         │  https://{DOMAIN_CONFIG.api}   │
│       │                         │  例如 test-api.shiningacg.club  │
└───────┼─────────────────────────┼────────────────────────────────┘
        │                         │
        │                         ▼
┌───────┼─────────────────────────┼────────────────────────────────┐
│  Go 后端  packages/server (:8000)                                 │
│       │                         │                                │
│       │   Connect / Vanguard 按路径路由到某个 Service Handler     │
│       │                         │                                │
│       │   service（薄：proto ↔ 业务）                             │
│       │         → biz（业务编排，按能力边界分包）                   │
│       │           → repo（查库 / 写库）                            │
│       │             → model（GORM 表结构）                         │
│       │                         │                                │
│       │                         ▼                                │
│       │                  PostgreSQL (:5433 本地)                   │
│       │                  MinIO（媒体文件，可选）                    │
└──────────────────────────────────────────────────────────────────┘
```

接口**合同**不写在 Express 路由文件里，而写在：

```text
packages/server/proto/api/.../*.proto
```

前后端共用同一份合同：后端 `buf generate` 出 Go；仓库根 `deno task gen:api` 出前端 `$lib/api`。

---

## 2. 打开首页时，前端发生了什么？

### 2.1 页面入口

| 角色 | 路径 |
|------|------|
| 首页路由 | `packages/web/src/routes/app/home/+page.svelte` |
| 每分类一个数据 Store | `packages/web/src/lib/stores/feed/feed-store.svelte.ts` |
| 组请求参数 / fetch 工厂 | `packages/web/src/lib/stores/feed/feed-api.ts` |
| 瀑布流 / 列表 UI | `packages/web/src/lib/components/custom/waterfall/...`、`feed-list/...` |
| 本地 Mock | `packages/web/src/lib/test/waterfall-data-mock.ts` |

页面职责可以记成：

1. 顶部分类 Tab（综合 / 关注 / 用户 / 分区…）硬编码在 `CATEGORY_OPTIONS`
2. 每个分类懒创建自己的 `FeedStore`
3. 帖子分类用瀑布流渲染 `V1PostPreview[]`；「用户」分类用列表渲染 `V1UserSummary[]`
4. 真正「要数据」的动作在 Store 的 `fetchFn` 里

### 2.2 设计上的接口（合同已定义）

Proto：

```text
packages/server/proto/api/main/feed/v1/feed_service.proto
```

| RPC | HTTP | 用途 |
|-----|------|------|
| `GetFeed` | `GET /v1/feed` | 统一内容流（帖子流 / 用户流） |
| `ListFeedCategories` | `GET /v1/feed/categories` | 动态分类（button group）；首页里相关调用仍注释着 |

请求里常见查询字段（由 `buildFeedQueryParams` 拼出）：

- `categoryId`：如 `general`、`following`
- `pagination.cursor` / `pagination.needNum`：游标分页
- `refreshType`：下拉刷新 / 上拉加载
- `filter.*`：关键词、排序、时间范围、作者等

响应形状（概念上）：

```text
GetFeedResponse
  content_type
  posts.items[] | users.items[] | following_authors...   （oneof，只会出现一种）
  cursor
```

前端类型与客户端来自生成物：

| 文件 | 内容 |
|------|------|
| `packages/web/src/lib/api/sdk.gen.ts` | `feedServiceGetFeed`、`feedServiceListFeedCategories` |
| `packages/web/src/lib/api/types.gen.ts` | `V1PostPreview`、`V1GetFeedResponse` 等 |
| `packages/web/swagger.swagger.json` | 给人看的 OpenAPI |

### 2.3 现状：Mock，不是真请求

`feed-api.ts` 里帖子流大致是这样（逻辑摘要）：

```ts
// 构建 query → 调 Mock（真接口已注释）
const queryParams = buildFeedQueryParams(...);
const response = await mockFetchFeed({ query: queryParams, url: '/v1/feed' });
// const response = await feedServiceGetFeed({ query: queryParams });
```

因此打开首页时：

1. Store 读 IndexedDB 缓存（如有）→ 骨架屏 / 旧数据
2. `createPostFetchFn` 调 `mockFetchFeed`，本地延迟后返回假帖子
3. **不会**出现对 `test-api.shiningacg.club/v1/feed` 的真实网络请求（除非你改回 `feedServiceGetFeed`）

接真后端时，前端侧通常只改这一处：解开 `feedServiceGetFeed`，删掉 / 停用 Mock。

### 2.4 真请求时，HTTP 怎么发出去？

| 步骤 | 代码位置 | 做什么 |
|------|----------|--------|
| 1 | `feedServiceGetFeed({ query })` | 生成客户端，`GET /v1/feed` |
| 2 | `packages/web/src/hey-api.svelte.ts` | Axios 实例；`Authorization: Bearer <token>`；`baseURL = https://${DOMAIN_CONFIG.api}` |
| 3 | `packages/web/src/lib/constants.ts` | 测试域 `test-api.shiningacg.club` / 正式 `api.shiningacg.club` |
| 4 | 本地调试 | 常用 Whistle 把 API 域名指到 `127.0.0.1:8000` |

你**不要手改** `packages/web/src/lib/api/**`；协议变了在仓库根跑：

```bash
deno task gen:api
```

---

## 3. 后端收到 `GET /v1/feed` 之后会怎样？（目标分层）

后端 README 约定的依赖方向：

```text
proto（合同）
  → service（接 HTTP/RPC，做类型映射，尽量不写复杂业务）
    → biz（用例 / 业务规则）
      → repo（SQL / 持久化）
        → model（表结构，GORM）
```

对应目录：

```text
packages/server/
  proto/api/main/feed/v1/     # 合同
  gen/proto/...               # buf 生成的 Go（勿手改）
  internal/service/           # Handler（当前尚无 feed.go）
  internal/biz/               # 业务（README 规划；Feed 边界示例写在文档里）
  internal/repo/              # 仓储（现有 db、resource 等）
  internal/model/post.go      # 帖子表等
  cmd/app.go                  # 把哪些 Service 挂到 HTTP 上
```

### 3.1 服务怎么挂到端口上？

入口在 `packages/server/cmd/app.go`：创建各个 Connect Handler，交给 Vanguard，再 `ListenAndServe`（默认配置端口 **8000**）。

当前实际注册的只有：

- Auth
- User
- Resource

**没有** `FeedService`。所以即便前端改成真 `feedServiceGetFeed`，本地后端现在也会对不上（404 / 未实现），除非后端补 Handler 并在 `app.go` 注册。

### 3.2 「取数据」在干什么？（用帖子表理解）

Feed 实现后，典型路径会是：

1. **service**：解析 `category_id`、cursor、filter，转成内部查询参数  
2. **biz**：按分类分支（综合推荐 / 关注流 / 某分区 / 用户列表…），拼业务规则  
3. **repo**：用 GORM 查 PostgreSQL  

帖子表模型在：

```text
packages/server/internal/model/post.go
```

注释里已经写了 Feed 相关索引意图，例如：

- 分区瀑布流：`partition_id + created_at + id` 游标分页  
- 关注流 / 个人帖：`author_id + created_at + id`  
- 软删除局部索引（`deleted_at IS NULL`）

查到的行再映射成 proto 里的 `PostPreview`（封面 URL、作者摘要、点赞数等），放进 `GetFeedResponse.posts.items`，带上下一页 `cursor` 返回。

图片本身一般不塞库里，库里存的是资源 ID / object key；文件在 **MinIO**。首页卡片封面多半是 URL 或可拼出的对象地址。

### 3.3 对照：一条已经挂上的接口长什么样？

方便建立直觉——**User.GetMe**（仍是伪实现，但链路完整）：

| 层 | 位置 |
|----|------|
| 合同 | `packages/server/proto/api/main/user/v1/user_service.proto` → `GET /v1/users/me` |
| 前端客户端 | `$lib/api` → `userServiceGetMe` |
| 后端 Handler | `packages/server/internal/service/user.go` 的 `GetMe` |
| 注册 | `cmd/app.go` 里 `NewUserServiceHandler` |

`GetMe` 当前直接 `return` 写死的用户资料，**还没走 repo 查库**。Resource 上传相关则更接近「真业务」：`service/resource.go` → usecase → `repo/resource.go` → DB / 对象存储。

Feed 将来会更像 Resource 那条「真取数」路径，而不是一直 Mock / 写死。

---

## 4. 端到端时序（目标态）

```text
用户打开 /app/home
        │
        ▼
Home 为当前分类创建 FeedStore
        │
        ▼
估算 needNum → fetchFn(createPostFetchFn)
        │
        ▼
feedServiceGetFeed({ query: { categoryId, pagination.*, filter.*, refreshType } })
        │
        ▼
Axios → https://api域名/v1/feed   (+ Bearer)
        │
        ▼
Go :8000  Vanguard 路由到 FeedService.GetFeed
        │
        ▼
service → biz（按分类选策略）→ repo 查 posts / follows / users …
        │
        ▼
组装 GetFeedResponse（posts.items + cursor）JSON 返回
        │
        ▼
Store 去重、写入 items、可选写入 IndexedDB 缓存
        │
        ▼
WaterfallContainer 渲染卡片
```

**当前态**把中间「Axios → Go → DB」整段替换成了 `mockFetchFeed` 本地造数；UI / Store / 类型仍按真响应在写，所以后端就绪后切换成本较低。

---

## 5. 你作为前端，日常怎么跟这条链路打交道？

1. **看有没有接口**：`swagger.swagger.json` 或 `$lib/api/sdk.gen.ts`  
2. **页面里只 import 生成函数**，不要手改 `src/lib/api/**`  
3. **协议变更**：根目录 `deno task gen:api`  
4. **Swagger 有 ≠ 后端已实现**：以 `cmd/app.go` 是否注册、Handler 是否还是 `Unimplemented` / 伪实现为准  
5. **本地联调**：`packages/server` 起 Docker（Postgres 等）+ `go run ./cmd`；web `deno task dev`；代理 API 域名到本机 8000  
6. **首页 Feed**：接真数据时改 `feed-api.ts` 的 fetch，并跟后端确认 Feed 已实现且已注册

---

## 6. 关键文件速查

| 你想… | 打开 |
|------|------|
| 首页编排 | `packages/web/src/routes/app/home/+page.svelte` |
| 请求参数 / Mock↔真 API 切换点 | `packages/web/src/lib/stores/feed/feed-api.ts` |
| 列表状态机（刷新 / 加载更多 / 缓存） | `packages/web/src/lib/stores/feed/feed-store.svelte.ts` |
| 已生成的 Feed 客户端 | `packages/web/src/lib/api/sdk.gen.ts`（搜 `feedService`） |
| Token / baseURL | `packages/web/src/hey-api.svelte.ts`、`constants.ts` |
| Feed 合同 | `packages/server/proto/api/main/feed/v1/` |
| 后端挂了哪些服务 | `packages/server/cmd/app.go` |
| 帖子表 / Feed 索引意图 | `packages/server/internal/model/post.go` |
| 后端分层总说明 | `packages/server/README.md` |
| 更短的前后端总览 | `docs/前端工程师看后端.md` |

---

## 7. 三条记忆钉

1. **合同在 proto，前端用生成客户端，库只让后端碰。**  
2. **首页 Feed 的「产品形态」前端已按 `GET /v1/feed` 在写，但线上路径目前被 Mock 短路。**  
3. **后端「有 proto」和「app.go 已注册且能查库返回」是两件事**；联调前先确认第二件。
