# Shining ACG API 文档

## 概述

Shining ACG 后端 API 使用 Protocol Buffers v3 定义，通过 Buf v2 工具链管理，使用 Connect-Go 框架实现同时支持以下三种调用方式：

1. **gRPC**：高性能的二进制协议，适用于后端服务间通信
2. **gRPC-Web**：浏览器兼容的 gRPC 版本，适用于前端直接调用
3. **HTTP/JSON**：标准的 HTTP + JSON 协议，适用于任何 HTTP 客户端

## 通用规则

### 基础 URL

- **开发环境**：`http://localhost:8080`
- **生产环境**：`https://api.shining-acg.com`

### API 版本

所有 API 都使用版本化路径，当前版本为 `v1`。

### HTTP 请求格式

**Connect-Go 标准路由格式**：
```
POST /<package>.<service>/<method>
```

**路由示例**：
- 认证服务登录：`POST /api.account.v1.AuthService/Login`
- 用户服务获取当前用户：`POST /api.account.v1.UserService/GetMe`
- 内容服务创建帖子：`POST /api.community.v1.ContentService/CreatePost`

### 认证

#### Access Token

大部分 API 需要在请求头中包含访问令牌：

```http
Authorization: Bearer <access_token>
```

**gRPC 元数据：**
```
authorization: Bearer <access_token>
```

#### Refresh Token

当 Access Token 过期时，使用 Refresh Token 换取新的 Access Token。

### 通用请求格式

大多数 API 使用 `POST` 方法，并在请求体中包含 JSON 格式的参数。对于标记为 `NO_SIDE_EFFECTS` 的无副作用查询类方法，同时支持 `GET` 方法以提高性能和启用 CDN 缓存。

使用 GET 方法时，请求参数应编码为查询字符串，且 **不能不包含 Query**，如果不包含 Query 则会识别为 `POST` 方法导致 415 错误。

有关 `GET` 方法的调用：
- 自动处理：前端应使用生成的 @connectrpc/connect SDK。只需在初始化 Transport 时配置 useHttpGet: true，客户端将根据 proto 契约自动判断请求方法，并完成参数的 Base64 编码与 URL 拼接。
- 请求头规范：无论使用 POST 还是 GET，鉴权信息（如 Authorization）必须始终通过 HTTP Header 传递，严禁将敏感凭证放入查询字符串中。
- 缓存控制：对于 GET 请求，后端会根据业务需要返回 Cache-Control 头部。前端如需强制刷新，可利用 SDK 提供的拦截器在请求中加入随机版本参数。

### Connect-Go 标准错误码

| 状态码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| 0 | 成功 | 200 |
| 3 | 无效参数 | 400 |
| 16 | 未认证 | 401 |
| 7 | 无权限 | 403 |
| 5 | 资源不存在 | 404 |
| 6 | 资源已存在 | 409 |
| 13 | 内部服务器错误 | 500 |

---

## API 目录

### 1. 公共模块 (api.common.v1)

#### 1.1 ResourceService - 资源上传服务

**gRPC 服务名**：`api.common.v1.ResourceService`

**HTTP 基础路径**：`/api.common.v1.ResourceService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| GetUploadTokens | `GetUploadTokens` | `POST /api.common.v1.ResourceService/GetUploadTokens` | 获取文件上传凭证（支持批量），包含文件类型检查、大小限制检查、生成预签名 URL | 需要 |

#### 消息类型

**ResourceScene 枚举**：
- `SCENE_UNSPECIFIED` (0)：未指定
- `SCENE_USER_AVATAR` (1)：用户头像（限制 <2MB，正方形）
- `SCENE_POST_IMAGE` (2)：帖子图片（限制 <10MB）
- `SCENE_POST_VIDEO` (3)：帖子视频（限制 <500MB）
- `SCENE_COMMENT_IMAGE` (4)：评论图片
- `SCENE_CHAT_FILE` (5)：私聊文件（可能需要私有读权限）

**UploadTask**：
```proto
message UploadTask {
  string filename = 1;       // 原始文件名 (e.g. "photo.jpg")
  int64 size_bytes = 2;      // 文件大小 (字节)
  string mime_type = 3;      // MIME类型 (e.g. "image/jpeg", "video/mp4")
  string file_hash = 4;      // (可选) MD5/SHA256，用于秒传检测
}
```

**UploadToken**：
```proto
message UploadToken {
  string task_id = 1;        // 对应请求中的文件名或索引
  string upload_url = 2;     // 上传地址 (PUT Signed URL)
  string public_url = 3;     // 最终访问地址 (存入 DB 的地址)
  map<string, string> required_headers = 4;  // HTTP Header 要求
  bool skip_upload = 5;      // 秒传标志
}
```

#### 示例调用

**HTTP 请求**：
```bash
curl -X POST http://localhost:8080/api.common.v1.ResourceService/GetUploadTokens \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scene": 2,
    "tasks": [
      {
        "filename": "test.jpg",
        "size_bytes": 102400,
        "mime_type": "image/jpeg",
        "file_hash": "abc123"
      }
    ]
  }'
```

**响应示例**：
```json
{
  "tokens": [
    {
      "task_id": "test.jpg",
      "upload_url": "https://upload.example.com/abc123?token=def456",
      "public_url": "https://cdn.example.com/abc123.jpg",
      "required_headers": {
        "Content-Type": "image/jpeg"
      },
      "skip_upload": false
    }
  ]
}
```

**返回码说明**：
- 200：成功获取上传凭证
- 401：未认证
- 403：无权限
- 400：参数无效（如文件大小超限、类型不支持）

---

### 2. 用户账户模块 (api.account.v1)

#### 2.1 AuthService - 认证服务

**gRPC 服务名**：`api.account.v1.AuthService`

**HTTP 基础路径**：`/api.account.v1.AuthService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| Login | `Login` | `POST /api.account.v1.AuthService/Login` | 统一登录接口（支持 QQ、微信、手机号等） | 不需要 |
| Logout | `Logout` | `POST /api.account.v1.AuthService/Logout` | 退出登录 | 需要 |
| RefreshToken | `RefreshToken` | `POST /api.account.v1.AuthService/RefreshToken` | 刷新 Token | 需要 |

#### 消息类型

**LoginType 枚举**：
- `LOGIN_TYPE_UNSPECIFIED` (0)：未指定
- `LOGIN_TYPE_QQ` (1)：QQ 快捷登录

**DeviceInfo**：
```proto
message DeviceInfo {
  string device_type = 1;        // 设备类型 (e.g. "mobile", "desktop")
  string device_name = 2;        // 设备名 (e.g. "iPhone 14 Pro")
  string os_version = 3;         // 系统版本 (e.g. "iOS 16.0")
  string client_version = 4;     // App/前端版本号
}
```

#### Login - 登录

**请求参数**：
```json
{
  "type": 1,                          // 登录类型：1=QQ登录
  "credential": "your-qq-token",     // QQ OAuth Access Token
  "device": {                        // 设备信息
    "device_type": "mobile",
    "device_name": "iPhone 14",
    "os_version": "iOS 16.0",
    "client_version": "1.0.0"
  }
}
```

**响应示例**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access_expire_at": 1733232000,    // Access Token 过期时间戳
  "refresh_expire_at": 1735824000,   // Refresh Token 过期时间戳
  "user": {
    "user_id": "12345",
    "nickname": "用户昵称",
    "avatar": "https://example.com/avatar.jpg",
    "primary_department": 1,
    "is_verified": false
  },
  "is_new_user": false               // 是否是首次登录
}
```

**返回码说明**：
- 200：登录成功
- 400：参数无效（如 type 无效、credential 为空）
- 401：凭证无效（如 Access Token 过期、无效）
- 500：服务器内部错误

#### Logout - 退出登录

**请求参数**：
```json
{
  "logout_all_devices": true         // 是否踢掉所有设备
}
```

**响应示例**：
```json
{}
```

**返回码说明**：
- 200：退出成功
- 401：未认证

#### RefreshToken - 刷新 Token

**请求参数**：
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应示例**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access_expire_at": 1733232000,
  "refresh_expire_at": 1735824000
}
```

**返回码说明**：
- 200：刷新成功
- 401：Refresh Token 无效或过期
- 400：参数无效

---

#### 2.2 UserService - 用户服务

**gRPC 服务名**：`api.account.v1.UserService`

**HTTP 基础路径**：`/api.account.v1.UserService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| GetMe | `GetMe` | `GET /api.account.v1.UserService/GetMe` | 获取当前登录用户的完整信息（包含敏感设置） | 需要 |
| GetUser | `GetUser` | `GET /api.account.v1.UserService/GetUser` | 获取他人公开信息（经过隐私计算） | 需要 |
| BatchGetUsers | `BatchGetUsers` | `GET /api.account.v1.UserService/BatchGetUsers` | 批量获取用户信息（用于列表页头像渲染等） | 需要 |
| UpdateProfile | `UpdateProfile` | `POST /api.account.v1.UserService/UpdateProfile` | 更新个人资料（支持部分更新） | 需要 |
| UpdateSettings | `UpdateSettings` | `POST /api.account.v1.UserService/UpdateSettings` | 更新设置（合并了通用设置和隐私设置） | 需要 |
| SetFollow | `SetFollow` | `POST /api.account.v1.UserService/SetFollow` | 关注/取消关注 | 需要 |
| ListRelationships | `ListRelationships` | `POST /api.account.v1.UserService/ListRelationships` | 获取关系列表（粉丝/关注） | 需要 |
| ListMutualFollowers | `ListMutualFollowers` | `POST /api.account.v1.UserService/ListMutualFollowers` | 获取共同关注 | 需要 |
| SearchUsers | `SearchUsers` | `POST /api.account.v1.UserService/SearchUsers` | 搜索用户 | 需要 |

#### GetMe - 获取当前用户信息

**请求参数**：
```json
{}
```

**响应示例**：
```json
{
  "profile": {
    "base": {
      "user_id": "12345",
      "nickname": "用户昵称",
      "avatar": "https://example.com/avatar.jpg",
      "primary_department": 1,
      "is_verified": false
    },
    "intro": "这是我的个人简介",
    "background_image": "https://example.com/background.jpg",
    "departments": [1],
    "links": [],
    "stats": {
      "follower_count": 10,
      "following_count": 5,
      "post_count": 20,
      "like_count_received": 100,
      "view_count_received": 1000
    },
    "relation_status": {},
    "ip_location": "北京",
    "role": 1
  },
  "privacy_settings": {
    "message_permission": 0,
    "list_visibility": 0,
    "show_online_status": true
  },
  "user_settings": {
    "enable_push": true,
    "enable_email_notification": false,
    "language": "zh-CN",
    "theme": "dark"
  }
}
```

**返回码说明**：
- 200：成功
- 401：未认证

#### UpdateProfile - 更新个人资料

**请求参数**：
```json
{
  "profile": {
    "nickname": "新昵称",
    "intro": "新简介"
  },
  "update_mask": {
    "paths": ["nickname", "intro"]
  }
}
```

**返回码说明**：
- 200：更新成功
- 401：未认证
- 400：参数无效（如 nickname 为空）
- 403：权限不足

---

#### 2.3 UserAdminService - 用户管理服务

**gRPC 服务名**：`api.account.v1.UserAdminService`

**HTTP 基础路径**：`/api.account.v1.UserAdminService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| UpdateUserRole | `UpdateUserRole` | `POST /api.account.v1.UserAdminService/UpdateUserRole` | 修改用户角色（提拔管理员/封号） | 需要 |
| BanUser | `BanUser` | `POST /api.account.v1.UserAdminService/BanUser` | 封禁/解封用户（支持细粒度控制） | 需要 |
| AdminSearchUsers | `AdminSearchUsers` | `GET /api.account.v1.UserAdminService/AdminSearchUsers` | 后台搜索用户（权限更大） | 需要 |

---

### 3. 社区模块 (api.community.v1)

#### 3.1 ContentService - 内容服务

**gRPC 服务名**：`api.community.v1.ContentService`

**HTTP 基础路径**：`/api.community.v1.ContentService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| CreatePost | `CreatePost` | `POST /api.community.v1.ContentService/CreatePost` | 发布帖子 | 需要 |
| DeletePost | `DeletePost` | `POST /api.community.v1.ContentService/DeletePost` | 删除帖子 | 需要 |
| GetPost | `GetPost` | `GET /api.community.v1.ContentService/GetPost` | 获取帖子详情 | 需要 |
| ListPosts | `ListPosts` | `GET /api.community.v1.ContentService/ListPosts` | 统一帖子列表接口（支持多种场景） | 需要 |

#### CreatePost - 创建帖子

**请求参数**：
```json
{
  "title": "帖子标题",
  "content": "帖子内容",
  "media": [
    {
      "type": "image",
      "url": "https://example.com/image.jpg",
      "width": 800,
      "height": 600
    }
  ],
  "partition_id": 1
}
```

**响应示例**：
```json
{
  "post": {
    "post_id": "post123",
    "author": {
      "user_id": "12345",
      "nickname": "用户昵称",
      "avatar": "https://example.com/avatar.jpg",
      "primary_department": 1,
      "is_verified": false
    },
    "title": "帖子标题",
    "content": "帖子内容",
    "media": [
      {
        "type": "image",
        "url": "https://example.com/image.jpg",
        "width": 800,
        "height": 600
      }
    ],
    "department_id": 1,
    "department_name": "轻音部",
    "like_count": 0,
    "comment_count": 0,
    "collect_count": 0,
    "view_count": 0,
    "is_liked": false,
    "is_collected": false,
    "created_at": 1733232000,
    "updated_at": 1733232000,
    "status": 1
  }
}
```

**返回码说明**：
- 200：创建成功
- 401：未认证
- 400：参数无效（如 title 为空）
- 403：权限不足

#### ListPosts - 获取帖子列表

**请求参数**：
```json
{
  "scene": 2,                        // 场景：2=综合瀑布流
  "filter": {
    "keyword": "后端开发",
    "department_ids": [1],
    "author_id": "12345"
  },
  "sort": 2,                        // 排序：2=按热度
  "pagination": {
    "page_size": 10,
    "page": 1
  }
}
```

**响应示例**：
```json
{
  "posts": [
    {
      "post_id": "post123",
      "title": "帖子标题",
      "summary": "帖子内容摘要...",
      "cover": {
        "type": "image",
        "url": "https://example.com/image.jpg",
        "width": 800,
        "height": 600
      },
      "author": {
        "user_id": "12345",
        "nickname": "用户昵称",
        "avatar": "https://example.com/avatar.jpg",
        "primary_department": 1,
        "is_verified": false
      },
      "like_count": 100,
      "view_count": 1000,
      "comment_count": 10,
      "is_liked": false,
      "has_video": false,
      "publish_time": 1733232000,
      "partition_name": "轻音部"
    }
  ],
  "next_page_token": "abc123"
}
```

---

#### 3.2 InteractionService - 互动服务

**gRPC 服务名**：`api.community.v1.InteractionService`

**HTTP 基础路径**：`/api.community.v1.InteractionService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| SetLike | `SetLike` | `POST /api.community.v1.InteractionService/SetLike` | 点赞/取消赞（支持帖子、评论） | 需要 |
| SetCollect | `SetCollect` | `POST /api.community.v1.InteractionService/SetCollect` | 收藏/取消收藏（通常仅针对帖子） | 需要 |

#### SetLike - 点赞/取消点赞

**请求参数**：
```json
{
  "target_id": "post123",           // 目标ID（帖子或评论）
  "type": 1,                        // 类型：1=帖子，2=评论
  "is_active": true                // true=点赞，false=取消
}
```

**响应示例**：
```json
{
  "is_active": true,               // 最终状态
  "like_count": 101               // 操作后的最新点赞数
}
```

**返回码说明**：
- 200：操作成功
- 401：未认证
- 404：目标不存在
- 400：参数无效

---

#### 3.3 CommentService - 评论服务

**gRPC 服务名**：`api.community.v1.CommentService`

**HTTP 基础路径**：`/api.community.v1.CommentService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| CreateComment | `CreateComment` | `POST /api.community.v1.CommentService/CreateComment` | 发送评论（支持一级评论和子评论） | 需要 |
| ListComments | `ListComments` | `GET /api.community.v1.CommentService/ListComments` | 获取评论列表 | 需要 |
| DeleteComment | `DeleteComment` | `POST /api.community.v1.CommentService/DeleteComment` | 删除评论 | 需要 |

---

#### 3.4 GovernanceService - 治理服务

**gRPC 服务名**：`api.community.v1.GovernanceService`

**HTTP 基础路径**：`/api.community.v1.GovernanceService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| ListReports | `ListReports` | `GET /api.community.v1.GovernanceService/ListReports` | 获取举报列表 | 需要（管理员） |
| ResolveReport | `ResolveReport` | `POST /api.community.v1.GovernanceService/ResolveReport` | 裁决举报（封禁、删除、忽略） | 需要（管理员） |

---

### 4. 官网模块 (api.cms.v1)

#### 4.1 PortalService - 官网展示服务

**gRPC 服务名**：`api.cms.v1.PortalService`

**HTTP 基础路径**：`/api.cms.v1.PortalService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| GetSiteConfig | `GetSiteConfig` | `GET /api.cms.v1.PortalService/GetSiteConfig` | 获取网站配置信息 | 不需要 |
| ListDepartments | `ListDepartments` | `GET /api.cms.v1.PortalService/ListDepartments` | 获取部门列表 | 不需要 |
| ListActivities | `ListActivities` | `GET /api.cms.v1.PortalService/ListActivities` | 获取活动列表 | 不需要 |
| ListHistory | `ListHistory` | `GET /api.cms.v1.PortalService/ListHistory` | 获取发展历程（大事记） | 不需要 |
| ListMinisters | `ListMinisters` | `GET /api.cms.v1.PortalService/ListMinisters` | 获取部长/历代领导列表 | 不需要 |
| ListStaff | `ListStaff` | `GET /api.cms.v1.PortalService/ListStaff` | 获取 Staff 名单 | 不需要 |
| ListSponsors | `ListSponsors` | `GET /api.cms.v1.PortalService/ListSponsors` | 获取赞助商/鸣谢名单 | 不需要 |
| ListHomeTrending | `ListHomeTrending` | `GET /api.cms.v1.PortalService/ListHomeTrending` | 获取首页热门动态 | 不需要 |

---

#### 4.2 SiteAdminService - 官网管理服务

**gRPC 服务名**：`api.cms.v1.SiteAdminService`

**HTTP 基础路径**：`/api.cms.v1.SiteAdminService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| UpsertDepartment | `UpsertDepartment` | `POST /api.cms.v1.SiteAdminService/UpsertDepartment` | 新增/更新部门信息 | 需要（管理员） |
| DeleteDepartment | `DeleteDepartment` | `POST /api.cms.v1.SiteAdminService/DeleteDepartment` | 删除部门 | 需要（管理员） |
| UpsertActivity | `UpsertActivity` | `POST /api.cms.v1.SiteAdminService/UpsertActivity` | 新增/更新活动信息 | 需要（管理员） |
| DeleteActivity | `DeleteActivity` | `POST /api.cms.v1.SiteAdminService/DeleteActivity` | 删除活动 | 需要（管理员） |
| UpsertHistoryEvent | `UpsertHistoryEvent` | `POST /api.cms.v1.SiteAdminService/UpsertHistoryEvent` | 新增/更新历史事件信息 | 需要（管理员） |
| DeleteHistoryEvent | `DeleteHistoryEvent` | `POST /api.cms.v1.SiteAdminService/DeleteHistoryEvent` | 删除历史事件 | 需要（管理员） |
| UpsertMinister | `UpsertMinister` | `POST /api.cms.v1.SiteAdminService/UpsertMinister` | 新增/更新部长信息 | 需要（管理员） |
| DeleteMinister | `DeleteMinister` | `POST /api.cms.v1.SiteAdminService/DeleteMinister` | 删除部长信息 | 需要（管理员） |
| UpsertStaffGroup | `UpsertStaffGroup` | `POST /api.cms.v1.SiteAdminService/UpsertStaffGroup` | 新增/更新 Staff 分组信息 | 需要（管理员） |
| DeleteStaffGroup | `DeleteStaffGroup` | `POST /api.cms.v1.SiteAdminService/DeleteStaffGroup` | 删除 Staff 分组 | 需要（管理员） |
| UpsertSponsor | `UpsertSponsor` | `POST /api.cms.v1.SiteAdminService/UpsertSponsor` | 新增/更新赞助者信息 | 需要（管理员） |
| DeleteSponsor | `DeleteSponsor` | `POST /api.cms.v1.SiteAdminService/DeleteSponsor` | 删除赞助者 | 需要（管理员） |

---

### 5. 消息通知模块 (api.messenger.v1)

#### 5.1 MessageService - 通知服务

**gRPC 服务名**：`api.messenger.v1.MessageService`

**HTTP 基础路径**：`/api.messenger.v1.MessageService`

| 方法 | gRPC 方法 | HTTP 路由 | 功能 | 认证 |
|------|-----------|----------|------|------|
| ListNotifications | `ListNotifications` | `GET /api.messenger.v1.MessageService/ListNotifications` | 获取通知列表（支持按分类筛选） | 需要 |
| GetUnreadCount | `GetUnreadCount` | `GET /api.messenger.v1.MessageService/GetUnreadCount` | 获取未读计数（用于显示红点） | 需要 |
| MarkRead | `MarkRead` | `POST /api.messenger.v1.MessageService/MarkRead` | 标记已读（支持全部/分类/单条） | 需要 |

#### GetUnreadCount - 获取未读计数

**请求参数**：
```json
{}
```

**响应示例**：
```json
{
  "total": 7,
  "category_interaction": 5,
  "category_comment": 2,
  "category_follow": 0,
  "category_system": 0
}
```

**返回码说明**：
- 200：成功
- 401：未认证

---

## 公共数据类型

### 分页 (Pagination)

```proto
message Pagination {
  int32 page_size = 1;    // 每页数量
  string page_token = 2;  // 游标（用于无限滚动）
  int32 page = 3;         // 页码（用于传统分页）
}
```

### 部门 (Department 枚举)

```proto
enum Department {
  DEPARTMENT_UNSPECIFIED = 0;
  DEPARTMENT_LIGHT_MUSIC = 1;     // 轻音部
  DEPARTMENT_WOTA = 2;            // WOTA
  DEPARTMENT_TOUHOU = 3;          // 东方组
  DEPARTMENT_LITERATURE = 4;      // 轻文部
  DEPARTMENT_MODEL_PLASTIC = 5;   // 模玩部
  DEPARTMENT_PUBLICITY = 6;       // 宣传部
  DEPARTMENT_ACTIVITY = 7;        // 活动部
  DEPARTMENT_COSPLAY = 8;         // COS 部
  DEPARTMENT_OTAKU_DANCE = 9;     // 宅舞部
  DEPARTMENT_ANIME = 10;          // 动漫研
  DEPARTMENT_VIDEO = 11;          // 视频组
  DEPARTMENT_MUSIC_GAME = 12;     // 音游组
  DEPARTMENT_V_TUBE = 13;         // V 曲组
  DEPARTMENT_MINECRAFT = 14;      // MC 组
}
```

### 用户角色 (Role 枚举)

```proto
enum Role {
  ROLE_VISITOR = 0;       // 游客
  ROLE_USER = 1;          // 用户
  ROLE_ADMIN = 2;         // 内容管理员
  ROLE_SUPER_ADMIN = 3;   // 超级管理员
}
```

### 用户摘要 (UserSummary)

```proto
message UserSummary {
  string user_id = 1;
  string nickname = 2;
  string avatar = 3;
  api.common.v1.Department primary_department = 4;
  bool is_verified = 5;
  string verified_title = 6;
}
```

### 媒体资源 (Media)

```proto
message Media {
  string type = 1;        // "image" | "video"
  string url = 2;         // 资源地址
  string thumbnail = 3;   // 缩略图（视频用）
  int32 width = 4;        // 宽
  int32 height = 5;       // 高
}
```

---

## 使用建议

### 1. 分页策略

- **无限滚动列表**：使用 `page_size` + `page_token`（游标分页）
- **传统分页**：使用 `page_size` + `page`（页码分页）

### 2. 字段掩码 (FieldMask)

在更新操作中（如 `UpdateProfile`），使用字段掩码指定需要更新的字段：

```json
{
  "profile": {
    "nickname": "新昵称"
  },
  "update_mask": {
    "paths": ["nickname"]
  }
}
```

### 3. 并发控制

- 对资源操作（点赞、收藏等）使用幂等设计
- 关键操作（如创建内容）使用事务保证一致性

### 4. 性能优化

- 对于频繁访问的数据（如网站配置），实现缓存机制
- 对于列表查询，使用索引优化查询性能
- 对于大图片/视频，使用 CDN 加速访问

---

## 版本更新日志

### v1.0.0 (2026-02-03)

- 初始化版本
- 包含用户认证、用户管理、社区内容、官网展示、消息通知等核心功能
- 使用 Connect-Go 框架支持 gRPC 和 HTTP/JSON
- 使用 Buf v2 管理 API 定义

---

*最后更新：2026-02-03*
