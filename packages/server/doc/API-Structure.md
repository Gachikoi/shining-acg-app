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

#### 1.1 消息类型集合

**Pagination - 分页请求**：
```proto
message Pagination {
  int32 page_size = 1;    // 每页数量
  string page_token = 2;  // 游标（用于无限滚动，最后一条数据的id）
  int32 page = 3;         // 页码（用于传统分页，页面偏移量）
}
```

**Department - 部门枚举**：
```proto
enum Department {
  DEPARTMENT_UNSPECIFIED = 0;     // 未定义，保留
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
  DEPARTMENT_SECRETARIAT = 15;    // 秘书处
}
```

**DepartmentBase - 部门基础元数据**：
```proto
message DepartmentBase {
  Department id = 1;      // 枚举 ID
  string name = 2;        // 全称 (如 "轻音部")
  // string icon_url = 3;   // 徽章图标 (SVG/PNG) - 用于个人主页徽章、帖子分区图标
}
```

**Role - 用户角色枚举**：
```proto
enum Role {
  ROLE_VISITOR = 0;     // 游客
  ROLE_USER = 1;        // 用户
  ROLE_ADMIN = 2;       // 内容管理员
  ROLE_SUPER_ADMIN = 3; // 超级管理员
}
```

**Media - 多媒体资源**：
```proto
message Media {
  string type = 1;        // "image" | "video"
  string url = 2;         // 资源地址
  string thumbnail = 3;   // 缩略图（视频用）
  int32 width = 4;        // 宽
  int32 height = 5;       // 高
}
```

**Link - 外部链接结构**：
```proto
message Link {
  string label = 1; // 链接显示文字
  string url = 2;   // 实际跳转地址
}
```

**UserSummary - 基础信息摘要**：
```proto
message UserSummary {
  string user_id = 1;
  string nickname = 2; // 昵称，若有备注优先显示备注
  string avatar = 3;
  repeated api.common.v1.DepartmentBase departments = 4; // 所有所属部门徽章
  bool is_verified = 5;              // 身份认证状态
  string verified_title = 6;         // 认证头衔（如：23届部长）
}
```

**ResourceScene - 资源场景枚举**：
```proto
enum ResourceScene {
  SCENE_UNSPECIFIED = 0;
  SCENE_USER_AVATAR = 1;   // 用户头像 (限制如 <2MB, 正方形)
  SCENE_POST_IMAGE = 2;    // 帖子图片 (限制如 <10MB)
  SCENE_POST_VIDEO = 3;    // 帖子视频 (限制如 <500MB)
  SCENE_COMMENT_IMAGE = 4; // 评论图片
  SCENE_CHAT_FILE = 5;     // 私聊文件 (可能需要私有读权限)
}
```

**UploadTask - 上传任务**：
```proto
message UploadTask {
  string filename = 1;   // 原始文件名 (e.g. "photo.jpg")
  int64 size_bytes = 2;  // 文件大小 (字节)
  string mime_type = 3;  // MIME类型 (e.g. "image/jpeg", "video/mp4")
  string file_hash = 4;  // (可选) MD5/SHA256，用于秒传检测
}
```

**UploadToken - 上传凭证**：
```proto
message UploadToken {
  string task_id = 1;    // 对应请求中的文件名或索引
  string upload_url = 2; // 上传地址 (PUT Signed URL)
  string public_url = 3; // 最终访问地址 (存入 DB 的地址)
  map<string, string> required_headers = 4;  // HTTP Header 要求
  bool skip_upload = 5;  // 秒传标志
}
```

#### 1.2 ResourceService - 资源上传服务

**gRPC 服务名**：`api.common.v1.ResourceService`

**HTTP 基础路径**：`/api.common.v1.ResourceService`

##### GetUploadTokens - 获取上传凭证

**HTTP 方法和路由**：`POST /api.common.v1.ResourceService/GetUploadTokens`

**功能**：获取文件上传凭证（支持批量），包含文件类型检查、大小限制检查、生成预签名 URL（Presigned URL）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "scene": 2,          // 场景 (决定存储桶 Bucket 和 路径前缀)
  "tasks": [           // 批量请求
    {
      "filename": "test.jpg",       // 原始文件名
      "size_bytes": 102400,         // 文件大小 (字节)
      "mime_type": "image/jpeg",    // MIME类型
      "file_hash": "abc123"         // (可选) MD5/SHA256，用于秒传检测
    }
  ]
}
```

**响应体字段**：
```json
{
  "tokens": [
    {
      "task_id": "test.jpg",               // 对应请求中的文件名或索引
      "upload_url": "https://upload.example.com/abc123?token=def456",  // 上传地址 (PUT Signed URL)
      "public_url": "https://cdn.example.com/abc123.jpg",             // 最终访问地址 (存入 DB 的地址)
      "required_headers": {                // HTTP Header 要求
        "Content-Type": "image/jpeg"
      },
      "skip_upload": false                 // 秒传标志
    }
  ]
}
```

**调用示例**：
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

**返回码说明**：
- 200：成功获取上传凭证
- 401：未认证
- 403：无权限
- 400：参数无效（如文件大小超限、类型不支持）

---

### 2. 用户账户模块 (api.account.v1)

#### 2.1 消息类型集合

**LoginType - 登录类型枚举**：
```proto
enum LoginType {
  LOGIN_TYPE_UNSPECIFIED = 0;
  LOGIN_TYPE_QQ = 1;      // QQ 快捷登录
}
```

**DeviceInfo - 设备信息**：
```proto
message DeviceInfo {
  string device_type = 1;        // 设备类型 (e.g. "mobile", "desktop")
  string device_name = 2;        // 设备名 (e.g. "iPhone 14 Pro")
  string os_version = 3;         // 系统版本 (e.g. "iOS 16.0")
  string client_version = 4;     // App/前端版本号
  // string push_token = 5;      // 推送 Token (FCM/APNS/MiPush)，登录时上报方便推送
}
```

#### 2.2 AuthService - 认证服务

**gRPC 服务名**：`api.account.v1.AuthService`

**HTTP 基础路径**：`/api.account.v1.AuthService`

##### Login - 统一登录接口

**HTTP 方法和路由**：`POST /api.account.v1.AuthService/Login`

**功能**：统一登录接口（支持 QQ、微信、手机号等）

**是否需要认证**：不需要

**请求体字段**：
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

**响应体字段**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",     // 短期令牌 (如 2小时)
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",    // 长期令牌 (如 30天)
  "access_expire_at": 1733232000,    // Access Token 过期绝对时间戳
  "refresh_expire_at": 1735824000,   // Refresh Token 过期绝对时间戳
  "user": {
    "user_id": "12345",
    "nickname": "用户昵称",
    "avatar": "https://example.com/avatar.jpg",
    "departments": [
      {
        "id": 1,
        "name": "轻音部"
      }
    ],
    "is_verified": false,
    "verified_title": ""
  },
  "is_new_user": false               // 是否是注册后首次登录 (前端据此跳转完善资料页)
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.AuthService/Login \
  -H "Content-Type: application/json" \
  -d '{
    "type": 1,
    "credential": "your-qq-token",
    "device": {
      "device_type": "mobile",
      "device_name": "iPhone 14",
      "os_version": "iOS 16.0",
      "client_version": "1.0.0"
    }
  }'
```

**返回码说明**：
- 200：登录成功
- 400：参数无效（如 type 无效、credential 为空）
- 401：凭证无效（如 Access Token 过期、无效）
- 500：服务器内部错误

##### Logout - 退出登录

**HTTP 方法和路由**：`POST /api.account.v1.AuthService/Logout`

**功能**：退出登录

**是否需要认证**：需要

**请求体字段**：
```json
{
  "logout_all_devices": true         // 是否踢掉所有设备 (修改密码后通常为 true)
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.AuthService/Logout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "logout_all_devices": true
  }'
```

**返回码说明**：
- 200：退出成功
- 401：未认证

##### RefreshToken - 刷新 Token

**HTTP 方法和路由**：`POST /api.account.v1.AuthService/RefreshToken`

**功能**：刷新 Token（换取新的 AccessToken）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应体字段**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",     // 新的短期令牌
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",    // 可选：实现 RefreshToken 轮转机制时，会下发新的 RT
  "access_expire_at": 1733232000,    // 新的 Access Token 过期时间戳
  "refresh_expire_at": 1735824000    // 新的 Refresh Token 过期时间戳
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.AuthService/RefreshToken \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**返回码说明**：
- 200：刷新成功
- 401：Refresh Token 无效或过期
- 400：参数无效

---

#### 2.3 消息类型集合

**UserProfile - 用户公开资料**：
```proto
message UserProfile {
  api.common.v1.UserSummary base = 1;  // 基础信息 (ID, Name, 头像, 部门徽章, 认证头衔)
  string intro = 2;                    // 简介
  string background_image = 3;         // 个人主页背景图
  repeated api.common.v1.Link links = 4;  // 外部链接
  UserStats stats = 5;                // 统计数据
  UserRelationStatus relation_status = 6; // 关系状态
  api.common.v1.Role role = 7;        // 用户角色
}
```

**UserStats - 统计数据**：
```proto
message UserStats {
  int64 follower_count = 1;
  int64 following_count = 2;
  int64 post_count = 3;
  int64 like_count_received = 4;       // 获得的赞
  int64 view_count_received = 5;       // 获得浏览
}
```

**UserRelationStatus - 关系状态**：
```proto
message UserRelationStatus {
  bool is_following = 1;       // 我是否关注了他
  bool is_followed_by = 2;     // 他是否关注了我 (互关判断)
  bool is_blocking = 3;        // 我是否拉黑了他
  string remark = 4;           // 我给他的备注
  bool can_send_message = 10;  // 是否能发私信
  bool can_view_list = 11;     // 是否能看他的关注列表
  bool can_view_liked_posts = 12; // 是否能看他的点赞帖子
  bool can_view_collected_posts = 13; // 是否能看他的收藏帖子
}
```

**PrivacySettings - 隐私设置**：
```proto
message PrivacySettings {
  PrivacyLevel message_permission = 1;    // 谁可以私信我
  PrivacyLevel list_visibility = 2;       // 谁可以看我的关注/粉丝列表
  PrivacyLevel liked_posts_visibility = 3; // 谁可以看我的点赞帖子
  PrivacyLevel collected_posts_visibility = 4; // 谁可以看我的收藏帖子
}
```

**UserSettings - 通用设置**：
```proto
message UserSettings {
  bool enable_push = 1;
  bool enable_email_notification = 2;
}
```

**PrivacyLevel - 隐私级别枚举**：
```proto
enum PrivacyLevel {
  PRIVACY_LEVEL_PUBLIC = 0;
  PRIVACY_LEVEL_FOLLOWERS = 1;
  PRIVACY_LEVEL_MUTUAL = 2;
  PRIVACY_LEVEL_PRIVATE = 3;
}
```

#### 2.4 UserService - 用户服务

**gRPC 服务名**：`api.account.v1.UserService`

**HTTP 基础路径**：`/api.account.v1.UserService`

##### GetMe - 获取当前用户完整信息

**HTTP 方法和路由**：`GET /api.account.v1.UserService/GetMe`

**功能**：获取当前登录用户的完整信息（包含敏感设置）

**是否需要认证**：需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "profile": {
    "base": {
      "user_id": "12345",
      "nickname": "用户昵称",
      "avatar": "https://example.com/avatar.jpg",
      "departments": [
        {
          "id": 1,
          "name": "轻音部"
        }
      ],
      "is_verified": false,
      "verified_title": ""
    },
    "intro": "这是我的个人简介",
    "background_image": "https://example.com/background.jpg",
    "links": [],
    "stats": {
      "follower_count": 10,
      "following_count": 5,
      "post_count": 20,
      "like_count_received": 100,
      "view_count_received": 1000
    },
    "relation_status": {},
    "role": 1
  },
  "privacy_settings": {
    "message_permission": 0,
    "list_visibility": 0,
    "liked_posts_visibility": 0,
    "collected_posts_visibility": 0,
  },
  "user_settings": {
    "enable_push": true,
    "enable_email_notification": false,
  }
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.account.v1.UserService/GetMe \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证

##### GetUser - 获取他人公开信息

**HTTP 方法和路由**：`GET /api.account.v1.UserService/GetUser`

**功能**：获取他人公开信息（经过隐私计算）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "target_user_id": "user123"
}
```

**响应体字段**：
```json
{
  "profile": {
    "base": {
      "user_id": "user123",
      "nickname": "用户昵称",
      "avatar": "https://example.com/avatar.jpg",
      "departments": [
        {
          "id": 1,
          "name": "轻音部"
        }
      ],
      "is_verified": false,
      "verified_title": ""
    },
    "intro": "这是我的个人简介",
    "background_image": "https://example.com/background.jpg",
    "links": [],
    "stats": {
      "follower_count": 10,
      "following_count": 5,
      "post_count": 20,
      "like_count_received": 100,
      "view_count_received": 1000
    },
    "relation_status": {
      "is_following": false,
      "is_followed_by": false,
      "can_send_message": true
    },
    "role": 1
  }
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.account.v1.UserService/GetUser?target_user_id=user123" \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证
- 404：用户不存在

##### BatchGetUsers - 批量获取用户信息

**HTTP 方法和路由**：`POST /api.account.v1.UserService/BatchGetUsers`

**功能**：批量获取用户信息（用于列表页头像渲染等）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "user_ids": ["user123", "user456"]
}
```

**响应体字段**：
```json
{
  "profiles": [
    {
      "base": {
        "user_id": "user123",
        "nickname": "用户1",
        "avatar": "https://example.com/avatar1.jpg",
        "departments": [{"id": 1, "name": "轻音部"}],
        "is_verified": false
      }
    },
    {
      "base": {
        "user_id": "user456",
        "nickname": "用户2",
        "avatar": "https://example.com/avatar2.jpg",
        "departments": [{"id": 2, "name": "WOTA"}],
        "is_verified": true,
        "verified_title": "部长"
      }
    }
  ]
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserService/BatchGetUsers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["user123", "user456"]
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证

##### UpdateProfile - 更新个人资料

**HTTP 方法和路由**：`POST /api.account.v1.UserService/UpdateProfile`

**功能**：更新个人资料（支持部分更新）

**是否需要认证**：需要

**请求体字段**：
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

**响应体字段**：
```json
{
  "profile": {
    "base": {
      "user_id": "12345",
      "nickname": "新昵称",
      "avatar": "https://example.com/avatar.jpg",
      "departments": [{"id": 1, "name": "轻音部"}],
      "is_verified": false
    },
    "intro": "新简介",
    "background_image": "https://example.com/background.jpg",
    "links": [],
    "stats": {
      "follower_count": 10,
      "following_count": 5,
      "post_count": 20,
      "like_count_received": 100,
      "view_count_received": 1000
    }
  }
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserService/UpdateProfile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "nickname": "新昵称",
      "intro": "新简介"
    },
    "update_mask": {
      "paths": ["nickname", "intro"]
    }
  }'
```

**返回码说明**：
- 200：更新成功
- 401：未认证
- 400：参数无效（如 nickname 为空）
- 403：权限不足

##### UpdateSettings - 更新设置

**HTTP 方法和路由**：`POST /api.account.v1.UserService/UpdateSettings`

**功能**：更新设置（合并了通用设置和隐私设置，通过 FieldMask 控制）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "privacy_settings": {
    "message_permission": 1,
    "liked_posts_visibility": 2,
    "collected_posts_visibility": 3
  },
  "user_settings": {
  },
  "update_mask": {
    "paths": ["privacy_settings.message_permission", "privacy_settings.liked_posts_visibility", "privacy_settings.collected_posts_visibility"]
  }
}
```

**响应体字段**：
```json
{
  "succeed": true
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserService/UpdateSettings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "privacy_settings": {
      "message_permission": 1
    },
    "user_settings": {
    },
    "update_mask": {
      "paths": ["privacy_settings.message_permission"]
    }
  }'
```

**返回码说明**：
- 200：更新成功
- 401：未认证
- 400：参数无效

##### SetFollow - 关注/取消关注

**HTTP 方法和路由**：`POST /api.account.v1.UserService/SetFollow`

**功能**：关注/取消关注

**是否需要认证**：需要

**请求体字段**：
```json
{
  "target_user_id": "user123",
  "is_active": true
}
```

**响应体字段**：
```json
{
  "is_active": true,
  "is_mutual": false
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserService/SetFollow \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_user_id": "user123",
    "is_active": true
  }'
```

**返回码说明**：
- 200：操作成功
- 401：未认证
- 404：用户不存在

##### ListRelationships - 获取关系列表

**HTTP 方法和路由**：`POST /api.account.v1.UserService/ListRelationships`

**功能**：获取关系列表（粉丝/关注）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "user_id": "12345",
  "type": 0,
  "pagination": {
    "page_size": 10,
    "page_token": ""
  }
}
```

**响应体字段**：
```json
{
  "users": [
    {
      "base": {
        "user_id": "user123",
        "nickname": "用户1",
        "avatar": "https://example.com/avatar1.jpg",
        "departments": [{"id": 1, "name": "轻音部"}],
        "is_verified": false
      }
    }
  ],
  "next_page_token": "abc123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserService/ListRelationships \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "12345",
    "type": 0,
    "pagination": {
      "page_size": 10,
      "page_token": ""
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证

##### ListMutualFollowers - 获取共同关注

**HTTP 方法和路由**：`POST /api.account.v1.UserService/ListMutualFollowers`

**功能**：获取共同关注

**是否需要认证**：需要

**请求体字段**：
```json
{
  "user_id": "user123",
  "pagination": {
    "page_size": 10,
    "page_token": ""
  }
}
```

**响应体字段**：
```json
{
  "users": [
    {
      "base": {
        "user_id": "user456",
        "nickname": "共同关注用户",
        "avatar": "https://example.com/avatar.jpg",
        "departments": [{"id": 1, "name": "轻音部"}],
        "is_verified": true
      }
    }
  ],
  "next_page_token": "abc123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserService/ListMutualFollowers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "pagination": {
      "page_size": 10,
      "page_token": ""
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证

##### ApplyVerification - 申请身份认证

**HTTP 方法和路由**：`POST /api.account.v1.UserService/ApplyVerification`

**功能**：申请身份认证

**是否需要认证**：需要

**请求体字段**：
```json
{
  "verified_title": "23届部长"
}
```

**响应体字段**：
```json
{
  "succeed": true,
  "message": "申请已提交，请等待审核"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserService/ApplyVerification \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "verified_title": "23届部长"
  }'
```

**返回码说明**：
- 200：申请成功
- 401：未认证
- 400：参数无效（如 verified_title 为空）

##### GetPrivacySettings - 获取隐私设置

**HTTP 方法和路由**：`GET /api.account.v1.UserService/GetPrivacySettings`

**功能**：获取当前用户的隐私设置

**是否需要认证**：需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "privacy_settings": {
    "message_permission": 0,
    "list_visibility": 0,
    "liked_posts_visibility": 0,
    "collected_posts_visibility": 0,
  }
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.account.v1.UserService/GetPrivacySettings \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证

##### GetUserSettings - 获取用户设置

**HTTP 方法和路由**：`GET /api.account.v1.UserService/GetUserSettings`

**功能**：获取当前用户的通用设置

**是否需要认证**：需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "user_settings": {
    "enable_push": true,
    "enable_email_notification": false
  }
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.account.v1.UserService/GetUserSettings \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证

##### SearchUsers - 搜索用户

**HTTP 方法和路由**：`POST /api.account.v1.UserService/SearchUsers`

**功能**：搜索用户

**是否需要认证**：需要

**请求体字段**：
```json
{
  "keyword": "用户",
  "pagination": {
    "page_size": 10,
    "page": 1
  }
}
```

**响应体字段**：
```json
{
  "results": [
    {
      "base": {
        "user_id": "user123",
        "nickname": "用户昵称",
        "avatar": "https://example.com/avatar.jpg",
        "departments": [{"id": 1, "name": "轻音部"}],
        "is_verified": false
      }
    }
  ],
  "next_page_token": "abc123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserService/SearchUsers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "用户",
    "pagination": {
      "page_size": 10,
      "page": 1
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证

---

#### 2.5 消息类型集合

**VerificationStatus - 认证申请状态枚举**：
```proto
enum VerificationStatus {
  VERIFICATION_STATUS_PENDING = 0;    // 待审核
  VERIFICATION_STATUS_APPROVED = 1;   // 已通过
  VERIFICATION_STATUS_REJECTED = 2;   // 已驳回
}
```

**VerificationApplication - 认证申请信息**：
```proto
message VerificationApplication {
  string application_id = 1;         // 申请ID
  string user_id = 2;                // 申请人ID
  api.common.v1.UserSummary user = 3; // 申请人信息
  string verified_title = 4;         // 申请的认证头衔
  VerificationStatus status = 5;     // 审核状态
  string reject_reason = 6;          // 驳回原因 (仅当 status 为 REJECTED 时有效)
  int64 created_at = 7;              // 申请时间戳
  int64 processed_at = 8;            // 处理时间戳
  string processed_by = 9;           // 处理人ID
}
```

#### 2.6 UserAdminService - 用户管理服务

**gRPC 服务名**：`api.account.v1.UserAdminService`

**HTTP 基础路径**：`/api.account.v1.UserAdminService`

##### UpdateUserRole - 修改用户角色

**HTTP 方法和路由**：`POST /api.account.v1.UserAdminService/UpdateUserRole`

**功能**：修改用户角色（提拔管理员/变更角色）

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "user_id": "user123",
  "role": 2
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserAdminService/UpdateUserRole \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "role": 2
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：用户不存在

##### BanUser - 封禁/解封用户

**HTTP 方法和路由**：`POST /api.account.v1.UserAdminService/BanUser`

**功能**：封禁/解封用户（更细粒度的控制，比如封禁3天）

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "user_id": "user123",
  "ban_duration_seconds": 86400, // 封禁1天
  "reason": "违规行为"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserAdminService/BanUser \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "ban_duration_seconds": 86400,
    "reason": "违规行为"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：用户不存在

##### AdminSearchUsers - 后台搜索用户

**HTTP 方法和路由**：`GET /api.account.v1.UserAdminService/AdminSearchUsers`

**功能**：后台搜索用户（比前台搜索权限更大，能搜到封禁用户等）

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "keyword": "用户",
  "pagination": {
    "page_size": 10,
    "page": 1
  }
}
```

**响应体字段**：
```json
{
  "users": [
    {
      "user_id": "user123",
      "nickname": "用户昵称",
      "avatar": "https://example.com/avatar.jpg",
      "departments": [{"id": 1, "name": "轻音部"}],
      "is_verified": false
    }
  ]
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.account.v1.UserAdminService/AdminSearchUsers?keyword=用户&pagination.page_size=10&pagination.page=1" \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足

##### ListVerificationApplications - 获取认证申请列表

**HTTP 方法和路由**：`GET /api.account.v1.UserAdminService/ListVerificationApplications`

**功能**：获取待审核的认证申请列表

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "status": 0,
  "pagination": {
    "page_size": 10,
    "page_token": ""
  }
}
```

**响应体字段**：
```json
{
  "applications": [
    {
      "application_id": "app123",
      "user_id": "user456",
      "user": {
        "user_id": "user456",
        "nickname": "申请人昵称",
        "avatar": "https://example.com/avatar.jpg",
        "departments": [
          {
            "id": 1,
            "name": "轻音部"
          }
        ],
        "is_verified": false
      },
      "verified_title": "23届部长",
      "status": 0,
      "created_at": 1733232000
    }
  ],
  "next_page_token": "abc123"
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.account.v1.UserAdminService/ListVerificationApplications?status=0&pagination.page_size=10" \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足

##### ApproveVerification - 审核认证申请

**HTTP 方法和路由**：`POST /api.account.v1.UserAdminService/ApproveVerification`

**功能**：审核认证申请（通过/驳回）

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "application_id": "app123",
  "approve": true,
  "reject_reason": "不符合认证条件"
}
```

**响应体字段**：
```json
{
  "succeed": true,
  "message": "审核成功"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.account.v1.UserAdminService/ApproveVerification \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "app123",
    "approve": true,
    "reject_reason": "不符合认证条件"
  }'
```

**返回码说明**：
- 200：审核成功
- 401：未认证
- 403：权限不足
- 404：申请不存在

### 3. 社区模块 (api.community.v1)

#### 3.1 消息类型集合

**Post - 帖子完整信息**：
```proto
message Post {
  string post_id = 1;
  api.common.v1.UserSummary author = 2;
  string title = 3;
  string content = 4;        // 详情页返回全文
  repeated api.common.v1.Media media = 5;
  api.common.v1.Department department_id = 6;
  string department_name = 7;
  int32 like_count = 8;
  int32 comment_count = 9;
  int32 collect_count = 10;
  int32 view_count = 11;
  bool is_liked = 12;
  bool is_collected = 13;
  bool is_following_author = 16; // 是否已关注作者
  int64 created_at = 14;
  int64 updated_at = 15;
  PostStatus status = 17;    // 帖子状态
}
```

**PostPreview - 帖子预览（卡片视图）**：
```proto
message PostPreview {
  string post_id = 1;
  string title = 2;
  string summary = 3;        // 内容摘要
  api.common.v1.Media cover = 4;
  api.common.v1.UserSummary author = 5;
  int32 like_count = 6;
  int32 view_count = 7;
  int32 comment_count = 8;
  bool is_liked = 9;
  bool has_video = 10;
  int64 publish_time = 11;
  string partition_name = 12;
}
```

**PostStatus - 帖子状态枚举**：
```proto
enum PostStatus {
  POST_STATUS_UNSPECIFIED = 0;
  POST_STATUS_PUBLISHED = 1; // 已发布
  POST_STATUS_AUDITING = 2;  // 审核中
  POST_STATUS_DELETED = 3;   // 已删除
}
```

**PostFilter - 帖子筛选器**：
```proto
message PostFilter {
  string keyword = 1;
  repeated api.common.v1.Department department_ids = 2;
  TimeRange time_range = 3;
  string author_id = 4;
  UserPostType user_post_type = 5;
}
```

**TimeRange - 时间范围**：
```proto
message TimeRange {
  int64 start_timestamp = 1; // 开始时间
  int64 end_timestamp = 2;   // 结束时间
}
```

**UserPostType - 用户帖子类型**：
```proto
enum UserPostType {
  USER_POST_TYPE_PUBLISHED = 0;
  USER_POST_TYPE_LIKED = 1;
  USER_POST_TYPE_COLLECTED = 2;
}
```

#### 3.2 ContentService - 内容服务

**gRPC 服务名**：`api.community.v1.ContentService`

**HTTP 基础路径**：`/api.community.v1.ContentService`

##### CreatePost - 发布帖子

**HTTP 方法和路由**：`POST /api.community.v1.ContentService/CreatePost`

**功能**：发布新帖子

**是否需要认证**：需要

**请求体字段**：
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

**响应体字段**：
```json
{
  "post": {
    "post_id": "post123",
    "author": {
      "user_id": "12345",
      "nickname": "用户昵称",
      "avatar": "https://example.com/avatar.jpg",
      "departments": [
        {
          "id": 1,
          "name": "轻音部"
        }
      ],
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

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.community.v1.ContentService/CreatePost \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**返回码说明**：
- 200：创建成功
- 401：未认证
- 400：参数无效（如 title 为空）
- 403：权限不足

##### DeletePost - 删除帖子

**HTTP 方法和路由**：`POST /api.community.v1.ContentService/DeletePost`

**功能**：删除帖子

**是否需要认证**：需要

**请求体字段**：
```json
{
  "post_id": "post123"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.community.v1.ContentService/DeletePost \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "post123"
  }'
```

**返回码说明**：
- 200：删除成功
- 401：未认证
- 403：权限不足
- 404：帖子不存在

##### GetPost - 获取帖子详情

**HTTP 方法和路由**：`GET /api.community.v1.ContentService/GetPost`

**功能**：获取帖子详细信息

**是否需要认证**：需要

**请求体字段**：
```json
{
  "post_id": "post123"
}
```

**响应体字段**：
```json
{
  "post": {
    "post_id": "post123",
    "author": {
      "user_id": "12345",
      "nickname": "用户昵称",
      "avatar": "https://example.com/avatar.jpg",
      "departments": [{"id": 1, "name": "轻音部"}],
      "is_verified": false
    },
    "title": "帖子标题",
    "content": "帖子内容",
    "media": [{"type": "image", "url": "https://example.com/image.jpg", "width": 800, "height": 600}],
    "department_id": 1,
    "department_name": "轻音部",
    "like_count": 100,
    "comment_count": 10,
    "collect_count": 5,
    "view_count": 1000,
    "is_liked": true,
    "is_collected": false,
    "created_at": 1733232000,
    "updated_at": 1733232000,
    "status": 1
  }
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.community.v1.ContentService/GetPost?post_id=post123" \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证
- 404：帖子不存在

##### ListPosts - 获取帖子列表

**HTTP 方法和路由**：`POST /api.community.v1.ContentService/ListPosts`

**功能**：统一帖子列表接口，支持多种场景和筛选条件

**是否需要认证**：需要

**请求体字段**：
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

**响应体字段**：
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
        "departments": [
          {
            "id": 1,
            "name": "轻音部"
          }
        ],
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

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.community.v1.ContentService/ListPosts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scene": 2,
    "filter": {
      "keyword": "后端开发",
      "department_ids": [1],
      "author_id": "12345"
    },
    "sort": 2,
    "pagination": {
      "page_size": 10,
      "page": 1
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 400：参数无效

#### 3.3 消息类型集合（互动与评论）

**TargetType - 目标类型枚举**：
```proto
enum TargetType {
  TARGET_TYPE_UNSPECIFIED = 0;
  TARGET_TYPE_POST = 1;
  TARGET_TYPE_COMMENT = 2;
}
```

**Comment - 评论**：
```proto
message Comment {
  string comment_id = 1;
  api.common.v1.UserSummary author = 2;
  string content = 3;
  string post_id = 4;
  string root_id = 5;
  string parent_id = 6;
  string reply_to_user_id = 7;
  string reply_to_user_name = 8;
  int32 like_count = 9;
  int32 reply_count = 10;
  bool is_liked = 11;
  bool is_author = 12;
  int64 created_at = 13;
  repeated Comment preview_replies = 14;
}
```

#### 3.4 InteractionService - 互动服务

**gRPC 服务名**：`api.community.v1.InteractionService`

**HTTP 基础路径**：`/api.community.v1.InteractionService`

##### SetLike - 点赞/取消赞

**HTTP 方法和路由**：`POST /api.community.v1.InteractionService/SetLike`

**功能**：点赞或取消点赞（支持帖子、评论）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "target_id": "post123",           // 目标ID（帖子或评论）
  "type": 1,                        // 类型：1=帖子，2=评论
  "is_active": true                // true=点赞，false=取消
}
```

**响应体字段**：
```json
{
  "is_active": true,               // 最终状态
  "like_count": 101                // 操作后的最新点赞数
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.community.v1.InteractionService/SetLike \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_id": "post123",
    "type": 1,
    "is_active": true
  }'
```

**返回码说明**：
- 200：操作成功
- 401：未认证
- 404：目标不存在
- 400：参数无效

##### SetCollect - 收藏/取消收藏

**HTTP 方法和路由**：`POST /api.community.v1.InteractionService/SetCollect`

**功能**：收藏或取消收藏（通常仅针对帖子）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "post_id": "post123",
  "is_active": true
}
```

**响应体字段**：
```json
{
  "is_active": true,
  "collect_count": 11               // 操作后的最新收藏数
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.community.v1.InteractionService/SetCollect \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "post123",
    "is_active": true
  }'
```

**返回码说明**：
- 200：操作成功
- 401：未认证
- 404：帖子不存在
- 400：参数无效

#### 3.5 CommentService - 评论服务

**gRPC 服务名**：`api.community.v1.CommentService`

**HTTP 基础路径**：`/api.community.v1.CommentService`

##### CreateComment - 发送评论

**HTTP 方法和路由**：`POST /api.community.v1.CommentService/CreateComment`

**功能**：发送评论（支持一级评论和子评论）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "post_id": "post123",
  "content": "这是一条评论",
  "root_id": "",
  "parent_id": ""
}
```

**响应体字段**：
```json
{
  "comment": {
    "comment_id": "cmt123",
    "author": {
      "user_id": "12345",
      "nickname": "用户昵称",
      "avatar": "https://example.com/avatar.jpg",
      "departments": [{"id": 1, "name": "轻音部"}],
      "is_verified": false
    },
    "content": "这是一条评论",
    "post_id": "post123",
    "root_id": "",
    "parent_id": "",
    "reply_to_user_id": "",
    "reply_to_user_name": "",
    "like_count": 0,
    "reply_count": 0,
    "is_liked": false,
    "is_author": false,
    "created_at": 1733232000,
    "preview_replies": []
  }
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.community.v1.CommentService/CreateComment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "post123",
    "content": "这是一条评论",
    "root_id": "",
    "parent_id": ""
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 404：帖子不存在
- 400：参数无效

##### ListComments - 获取评论列表

**HTTP 方法和路由**：`GET /api.community.v1.CommentService/ListComments`

**功能**：获取评论列表（支持一级评论和子评论）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "post_id": "post123",
  "root_id": "",
  "sort": 1,
  "pagination": {
    "page_size": 10,
    "page_token": ""
  }
}
```

**响应体字段**：
```json
{
  "comments": [
    {
      "comment_id": "cmt123",
      "author": {
        "user_id": "12345",
        "nickname": "用户昵称",
        "avatar": "https://example.com/avatar.jpg",
        "departments": [{"id": 1, "name": "轻音部"}],
        "is_verified": false
      },
      "content": "这是一条评论",
      "post_id": "post123",
      "root_id": "",
      "parent_id": "",
      "reply_to_user_id": "",
      "reply_to_user_name": "",
      "like_count": 0,
      "reply_count": 0,
      "is_liked": false,
      "is_author": false,
      "created_at": 1733232000,
      "preview_replies": []
    }
  ],
  "next_page_token": "abc123",
  "total_count": 1
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.community.v1.CommentService/ListComments?post_id=post123&root_id=&sort=1&pagination.page_size=10" \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证
- 404：帖子不存在

##### DeleteComment - 删除评论

**HTTP 方法和路由**：`POST /api.community.v1.CommentService/DeleteComment`

**功能**：删除评论

**是否需要认证**：需要

**请求体字段**：
```json
{
  "comment_id": "cmt123"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.community.v1.CommentService/DeleteComment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "comment_id": "cmt123"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：评论不存在

#### 3.6 消息类型集合（治理服务）

**ReportStatus - 举报状态枚举**：
```proto
enum ReportStatus {
  REPORT_STATUS_PENDING = 0;
  REPORT_STATUS_RESOLVED = 1;
  REPORT_STATUS_REJECTED = 2; // 驳回
}
```

**ReportTargetType - 举报目标类型枚举**：
```proto
enum ReportTargetType {
  REPORT_TARGET_TYPE_POST = 0;
  REPORT_TARGET_TYPE_COMMENT = 1;
  REPORT_TARGET_TYPE_USER = 2;
}
```

**Report - 举报信息**：
```proto
message Report {
  string id = 1;
  string reporter_id = 2;
  string target_id = 3;
  ReportTargetType type = 4;
  string reason = 5;
  ReportStatus status = 6;
  int64 created_at = 7;
}
```

#### 3.7 GovernanceService - 治理服务

**gRPC 服务名**：`api.community.v1.GovernanceService`

**HTTP 基础路径**：`/api.community.v1.GovernanceService`

##### ListReports - 获取举报列表

**HTTP 方法和路由**：`GET /api.community.v1.GovernanceService/ListReports`

**功能**：获取举报列表

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "status": 0,
  "pagination": {
    "page_size": 10,
    "page_token": ""
  }
}
```

**响应体字段**：
```json
{
  "reports": [
    {
      "id": "rep123",
      "reporter_id": "user456",
      "target_id": "post123",
      "type": 0,
      "reason": "内容违规",
      "status": 0,
      "created_at": 1733232000
    }
  ],
  "next_page_token": "abc123"
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.community.v1.GovernanceService/ListReports?status=0&pagination.page_size=10" \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足

##### ResolveReport - 裁决举报

**HTTP 方法和路由**：`POST /api.community.v1.GovernanceService/ResolveReport`

**功能**：裁决举报（封禁、删除、忽略）

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "report_id": "rep123",
  "action": 1,
  "note": "删除违规内容"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.community.v1.GovernanceService/ResolveReport \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": "rep123",
    "action": 1,
    "note": "删除违规内容"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：举报不存在

---

### 4. 官网模块 (api.cms.v1)

#### 4.1 消息类型集合

**DepartmentInfo - 部门信息**：
```proto
message DepartmentInfo {
  api.common.v1.DepartmentBase department_base = 1;
  string logo = 2;
  string cover_image = 3;
  string intro_video_url = 4; // 部门介绍视频
  string description = 5;
  repeated api.common.v1.Link links = 6;    // 使用 repeated 保证顺序
  int32 sort_order = 7;       // 排序权重，越大越靠前
}
```

**Activity - 活动**：
```proto
message Activity {
  string id = 1;
  string name = 2;
  string name_en = 3;
  string cover_image = 4;
  string intro_video_url = 5; // B站或红书视频链接
  string description = 6;
  int64 start_time = 7;       // 开始时间戳
  int64 end_time = 8;         // 结束时间戳
  repeated api.common.v1.Link links = 9;
  int32 sort_order = 10;
}
```

**HistoryEvent - 历史事件**：
```proto
message HistoryEvent {
  string id = 1;
  int32 year = 2;             // 单独拆分年份，方便前端做时间轴分组
  string date_str = 3;        // 显示用日期字符串 "2023.10.01"
  string title = 4;
  string description = 5;
  repeated string images = 6; // 可能有多张图
}
```

**Minister - 部长**：
```proto
message Minister {
  string id = 1;
  string name = 2;            // CN (需求中的 name)
  string avatar = 3;
  string signature = 4;       // 签名
  string description = 5;     // 简介
  string department_name = 6; // 所属部门名称

  // 届数/年份信息
  int32 session_number = 7;   // 第几届 (需求提到的按年代/代目划分)
  int32 year = 8;             // 任职年份

  repeated api.common.v1.Link links = 9;
}
```

**StaffMember - Staff 成员**：
```proto
message StaffMember {
  string name = 1;            // CN
  string avatar = 2;
  string role = 3;            // 职责 (e.g. "后端开发")
  string description = 4;     // 简介/寄语
  string donation_amount = 5; // (可选) 赞助金额，对应需求
  repeated api.common.v1.Link links = 6;
}
```

**StaffGroup - Staff 分组**：
```proto
message StaffGroup {
  string group_name = 1;
  repeated StaffMember members = 2;
}
```

**Sponsor - 赞助者**：
```proto
message Sponsor {
  string name = 1;
  string avatar = 2;
  string intro = 3;
  string amount_display = 4; // 显示金额，如 "￥50.00"
  //  repeated api.common.v1.Link links = 5;
}
```

**HomeTrendingItem - 首页热门动态**：
```proto
message HomeTrendingItem {
  string id = 1;             // 原始帖子ID
  string title = 2;
  string cover_image = 3;    // 封面
  string summary = 4;        // 摘要
  string author_name = 5;
  string author_avatar = 6;
  string jump_url = 7;       // 点击跳转地址 (App内链或H5链接)

  // 来源标记
  enum Source {
    SOURCE_COMMUNITY = 0; // 社区帖子
    SOURCE_OFFICIAL = 1;  // 官方公告
    SOURCE_EXTERNAL = 2;  // 外部爬取的红书/B站动态
  }
  Source source = 8;

  // 统计
  int32 like_count = 9;
}
```

#### 4.2 PortalService - 官网展示服务

**gRPC 服务名**：`api.cms.v1.PortalService`

**HTTP 基础路径**：`/api.cms.v1.PortalService`

##### GetSiteConfig - 获取网站配置信息

**HTTP 方法和路由**：`GET /api.cms.v1.PortalService/GetSiteConfig`

**功能**：获取网站配置信息，包括 Logo、宣传视频等基础信息

**是否需要认证**：不需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "site_name": "Shining ACG",
  "promo_video_url": "https://example.com/promo.mp4"
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.cms.v1.PortalService/GetSiteConfig
```

**返回码说明**：
- 200：成功
- 500：服务器内部错误

##### ListDepartments - 获取部门列表

**HTTP 方法和路由**：`GET /api.cms.v1.PortalService/ListDepartments`

**功能**：获取部门列表（支持按优先级排序）

**是否需要认证**：不需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "list": [
    {
      "department_base": {
        "id": 1,
        "name": "轻音部"
      },
      "logo": "https://example.com/ltb-logo.png",
      "cover_image": "https://example.com/ltb-cover.jpg",
      "intro_video_url": "https://example.com/ltb-video.mp4",
      "description": "轻音部是一个热爱音乐的社团...",
      "links": [
        {
          "label": "B站",
          "url": "https://space.bilibili.com/12345"
        }
      ],
      "sort_order": 10
    }
  ]
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.cms.v1.PortalService/ListDepartments
```

**返回码说明**：
- 200：成功
- 500：服务器内部错误

##### ListActivities - 获取活动列表

**HTTP 方法和路由**：`GET /api.cms.v1.PortalService/ListActivities`

**功能**：获取活动列表

**是否需要认证**：不需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "list": [
    {
      "id": "act123",
      "name": "夏日音乐节",
      "name_en": "Summer Music Festival",
      "cover_image": "https://example.com/act-cover.jpg",
      "intro_video_url": "https://example.com/act-video.mp4",
      "description": "这是一个精彩的音乐节活动...",
      "start_time": 1733232000,
      "end_time": 1733404800,
      "links": [
        {
          "label": "活动详情",
          "url": "https://example.com/activity/123"
        }
      ],
      "sort_order": 5
    }
  ]
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.cms.v1.PortalService/ListActivities
```

**返回码说明**：
- 200：成功
- 500：服务器内部错误

##### ListHistory - 获取发展历程

**HTTP 方法和路由**：`GET /api.cms.v1.PortalService/ListHistory`

**功能**：获取发展历程（大事记）

**是否需要认证**：不需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "list": [
    {
      "id": "his123",
      "year": 2023,
      "date_str": "2023.10.01",
      "title": "社团成立",
      "description": "Shining ACG社团正式成立...",
      "images": [
        "https://example.com/his1.jpg",
        "https://example.com/his2.jpg"
      ]
    }
  ]
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.cms.v1.PortalService/ListHistory
```

**返回码说明**：
- 200：成功
- 500：服务器内部错误

##### ListMinisters - 获取部长/历代领导列表

**HTTP 方法和路由**：`GET /api.cms.v1.PortalService/ListMinisters`

**功能**：获取部长/历代领导列表（按年份/届数查询）

**是否需要认证**：不需要

**请求体字段**：
```json
{
  "year": 2024
}
```

**响应体字段**：
```json
{
  "list": [
    {
      "year": 2024,
      "session_number": 23,
      "ministers": [
        {
          "id": "min123",
          "name": "张三",
          "avatar": "https://example.com/avatar.jpg",
          "signature": "热爱音乐，热爱生活",
          "description": "张三是23届轻音部部长...",
          "department_name": "轻音部",
          "session_number": 23,
          "year": 2024,
          "links": [
            {
              "label": "微博",
              "url": "https://weibo.com/zhangsan"
            }
          ]
        }
      ]
    }
  ]
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.cms.v1.PortalService/ListMinisters?year=2024"
```

**返回码说明**：
- 200：成功
- 500：服务器内部错误

##### ListStaff - 获取 Staff 名单

**HTTP 方法和路由**：`GET /api.cms.v1.PortalService/ListStaff`

**功能**：获取 Staff 名单（按分组返回）

**是否需要认证**：不需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "list": [
    {
      "group_name": "开发组",
      "members": [
        {
          "name": "李四",
          "avatar": "https://example.com/avatar.jpg",
          "role": "后端开发",
          "description": "负责社团网站后端开发...",
          "donation_amount": "￥100.00",
          "links": [
            {
              "label": "GitHub",
              "url": "https://github.com/lisi"
            }
          ]
        }
      ]
    }
  ]
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.cms.v1.PortalService/ListStaff
```

**返回码说明**：
- 200：成功
- 500：服务器内部错误

##### ListSponsors - 获取赞助者/鸣谢名单

**HTTP 方法和路由**：`GET /api.cms.v1.PortalService/ListSponsors`

**功能**：获取赞助者/鸣谢名单

**是否需要认证**：不需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "list": [
    {
      "name": "赞助商A",
      "avatar": "https://example.com/sponsor-logo.png",
      "intro": "这是一个热心的赞助商...",
      "amount_display": "￥500.00"
    }
  ]
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.cms.v1.PortalService/ListSponsors
```

**返回码说明**：
- 200：成功
- 500：服务器内部错误

##### ListHomeTrending - 获取首页热门动态

**HTTP 方法和路由**：`GET /api.cms.v1.PortalService/ListHomeTrending`

**功能**：获取首页热门动态（同步社区动态，无Token访问）

**是否需要认证**：不需要

**请求体字段**：
```json
{
  "limit": 6
}
```

**响应体字段**：
```json
{
  "list": [
    {
      "id": "post123",
      "title": "社团活动照片分享",
      "cover_image": "https://example.com/cover.jpg",
      "summary": "这是我们社团最近的活动照片...",
      "author_name": "王五",
      "author_avatar": "https://example.com/avatar.jpg",
      "jump_url": "https://example.com/post/123",
      "source": 0,
      "like_count": 100
    }
  ]
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.cms.v1.PortalService/ListHomeTrending?limit=6"
```

**返回码说明**：
- 200：成功
- 500：服务器内部错误

#### 4.3 SiteAdminService - 官网管理服务

**gRPC 服务名**：`api.cms.v1.SiteAdminService`

**HTTP 基础路径**：`/api.cms.v1.SiteAdminService`

##### UpsertDepartment - 新增/更新部门信息

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/UpsertDepartment`

**功能**：新增/更新部门信息

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "department": {
    "department_base": {
      "id": 1,
      "name": "轻音部"
    },
    "logo": "https://example.com/ltb-logo.png",
    "cover_image": "https://example.com/ltb-cover.jpg",
    "intro_video_url": "https://example.com/ltb-video.mp4",
    "description": "轻音部是一个热爱音乐的社团...",
    "links": [
      {
        "label": "B站",
        "url": "https://space.bilibili.com/12345"
      }
    ],
    "sort_order": 10
  }
}
```

**响应体字段**：
```json
{
  "department_id": "dept123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/UpsertDepartment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "department": {
      "department_base": {
        "id": 1,
        "name": "轻音部"
      },
      "logo": "https://example.com/ltb-logo.png",
      "cover_image": "https://example.com/ltb-cover.jpg",
      "intro_video_url": "https://example.com/ltb-video.mp4",
      "description": "轻音部是一个热爱音乐的社团...",
      "links": [
        {
          "label": "B站",
          "url": "https://space.bilibili.com/12345"
        }
      ],
      "sort_order": 10
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 400：参数无效

##### DeleteDepartment - 删除部门

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/DeleteDepartment`

**功能**：删除部门

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "id": "dept123"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/DeleteDepartment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "dept123"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：部门不存在

##### UpsertActivity - 新增/更新活动信息

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/UpsertActivity`

**功能**：新增/更新活动信息

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "activity": {
    "id": "act123",
    "name": "夏日音乐节",
    "name_en": "Summer Music Festival",
    "cover_image": "https://example.com/act-cover.jpg",
    "intro_video_url": "https://example.com/act-video.mp4",
    "description": "这是一个精彩的音乐节活动...",
    "start_time": 1733232000,
    "end_time": 1733404800,
    "links": [
      {
        "label": "活动详情",
        "url": "https://example.com/activity/123"
      }
    ],
    "sort_order": 5
  }
}
```

**响应体字段**：
```json
{
  "activity_id": "act123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/UpsertActivity \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "activity": {
      "id": "act123",
      "name": "夏日音乐节",
      "name_en": "Summer Music Festival",
      "cover_image": "https://example.com/act-cover.jpg",
      "intro_video_url": "https://example.com/act-video.mp4",
      "description": "这是一个精彩的音乐节活动...",
      "start_time": 1733232000,
      "end_time": 1733404800,
      "links": [
        {
          "label": "活动详情",
          "url": "https://example.com/activity/123"
        }
      ],
      "sort_order": 5
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 400：参数无效

##### DeleteActivity - 删除活动

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/DeleteActivity`

**功能**：删除活动

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "id": "act123"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/DeleteActivity \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "act123"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：活动不存在

##### UpsertHistoryEvent - 新增/更新历史事件信息

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/UpsertHistoryEvent`

**功能**：新增/更新历史事件信息

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "history_event": {
    "id": "his123",
    "year": 2023,
    "date_str": "2023.10.01",
    "title": "社团成立",
    "description": "Shining ACG社团正式成立...",
    "images": [
      "https://example.com/his1.jpg",
      "https://example.com/his2.jpg"
    ]
  }
}
```

**响应体字段**：
```json
{
  "event_id": "his123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/UpsertHistoryEvent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "history_event": {
      "id": "his123",
      "year": 2023,
      "date_str": "2023.10.01",
      "title": "社团成立",
      "description": "Shining ACG社团正式成立...",
      "images": [
        "https://example.com/his1.jpg",
        "https://example.com/his2.jpg"
      ]
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 400：参数无效

##### DeleteHistoryEvent - 删除历史事件

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/DeleteHistoryEvent`

**功能**：删除历史事件

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "id": "his123"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/DeleteHistoryEvent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "his123"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：历史事件不存在

##### UpsertMinister - 新增/更新部长信息

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/UpsertMinister`

**功能**：新增/更新部长信息

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "minister": {
    "id": "min123",
    "name": "张三",
    "avatar": "https://example.com/avatar.jpg",
    "signature": "热爱音乐，热爱生活",
    "description": "张三是23届轻音部部长...",
    "department_name": "轻音部",
    "session_number": 23,
    "year": 2024,
    "links": [
      {
        "label": "微博",
        "url": "https://weibo.com/zhangsan"
      }
    ]
  }
}
```

**响应体字段**：
```json
{
  "minister_id": "min123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/UpsertMinister \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "minister": {
      "id": "min123",
      "name": "张三",
      "avatar": "https://example.com/avatar.jpg",
      "signature": "热爱音乐，热爱生活",
      "description": "张三是23届轻音部部长...",
      "department_name": "轻音部",
      "session_number": 23,
      "year": 2024,
      "links": [
        {
          "label": "微博",
          "url": "https://weibo.com/zhangsan"
        }
      ]
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 400：参数无效

##### DeleteMinister - 删除部长信息

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/DeleteMinister`

**功能**：删除部长信息

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "id": "min123"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/DeleteMinister \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "min123"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：部长不存在

##### UpsertStaffGroup - 新增/更新 Staff 分组信息

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/UpsertStaffGroup`

**功能**：新增/更新 Staff 分组信息

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "staff_group": {
    "group_name": "开发组",
    "members": [
      {
        "name": "李四",
        "avatar": "https://example.com/avatar.jpg",
        "role": "后端开发",
        "description": "负责社团网站后端开发...",
        "donation_amount": "￥100.00",
        "links": [
          {
            "label": "GitHub",
            "url": "https://github.com/lisi"
          }
        ]
      }
    ]
  }
}
```

**响应体字段**：
```json
{
  "group_id": "group123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/UpsertStaffGroup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "staff_group": {
      "group_name": "开发组",
      "members": [
        {
          "name": "李四",
          "avatar": "https://example.com/avatar.jpg",
          "role": "后端开发",
          "description": "负责社团网站后端开发...",
          "donation_amount": "￥100.00",
          "links": [
            {
              "label": "GitHub",
              "url": "https://github.com/lisi"
            }
          ]
        }
      ]
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 400：参数无效

##### DeleteStaffGroup - 删除 Staff 分组

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/DeleteStaffGroup`

**功能**：删除 Staff 分组

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "id": "group123"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/DeleteStaffGroup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "group123"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：Staff 分组不存在

##### UpsertSponsor - 新增/更新赞助者信息

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/UpsertSponsor`

**功能**：新增/更新赞助者信息

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "sponsor": {
    "name": "赞助商A",
    "avatar": "https://example.com/sponsor-logo.png",
    "intro": "这是一个热心的赞助商...",
    "amount_display": "￥500.00"
  }
}
```

**响应体字段**：
```json
{
  "sponsor_id": "spon123"
}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/UpsertSponsor \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sponsor": {
      "name": "赞助商A",
      "avatar": "https://example.com/sponsor-logo.png",
      "intro": "这是一个热心的赞助商...",
      "amount_display": "￥500.00"
    }
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 400：参数无效

##### DeleteSponsor - 删除赞助者

**HTTP 方法和路由**：`POST /api.cms.v1.SiteAdminService/DeleteSponsor`

**功能**：删除赞助者

**是否需要认证**：需要（管理员权限）

**请求体字段**：
```json
{
  "id": "spon123"
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.cms.v1.SiteAdminService/DeleteSponsor \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "spon123"
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 403：权限不足
- 404：赞助者不存在

### 5. 消息通知模块 (api.messenger.v1)

#### 5.1 消息类型集合

**NotificationCategory - 通知大类枚举**：
```proto
enum NotificationCategory {
  CATEGORY_UNSPECIFIED = 0;
  CATEGORY_INTERACTION = 1; // 赞、收藏 (通常合并展示)
  CATEGORY_COMMENT = 2;     // 评论、@提到 (通常合并展示)
  CATEGORY_FOLLOW = 3;      // 新增关注
  CATEGORY_SYSTEM = 4;      // 系统通知 (活动、公告、举报反馈)
}
```

**NotificationType - 通知具体类型枚举**：
```proto
enum NotificationType {
  TYPE_UNSPECIFIED = 0;
  TYPE_LIKE_POST = 1;       // 赞了帖子
  TYPE_LIKE_COMMENT = 2;    // 赞了评论
  TYPE_COLLECT_POST = 3;    // 收藏了帖子
  TYPE_COMMENT_POST = 4;    // 评论了帖子
  TYPE_REPLY_COMMENT = 5;   // 回复了评论
  TYPE_MENTION = 6;         // @了你
  TYPE_FOLLOW = 7;          // 关注了你
  TYPE_SYSTEM_ANNOUNCEMENT = 8; // 官方公告
  TYPE_REPORT_RESULT = 9;       // 举报处理结果
}
```

**Notification - 通知信息**：
```proto
message Notification {
  string notification_id = 1;
  NotificationType type = 2;
  NotificationCategory category = 3;
  repeated api.common.v1.UserSummary actors = 4;
  int32 actor_count = 5;
  string title = 6;
  string content = 7;
  string target_id = 8;
  string target_type = 9;
  string target_preview_image = 10;
  string target_summary = 11;
  string redirect_url = 12;
  bool is_read = 13;
  int64 created_at = 14;
}
```

#### 5.2 MessageService - 通知服务

**gRPC 服务名**：`api.messenger.v1.MessageService`

**HTTP 基础路径**：`/api.messenger.v1.MessageService`

##### ListNotifications - 获取通知列表

**HTTP 方法和路由**：`GET /api.messenger.v1.MessageService/ListNotifications`

**功能**：获取通知列表（支持按分类筛选）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "category": 1,
  "pagination": {
    "page_size": 10,
    "page_token": ""
  }
}
```

**响应体字段**：
```json
{
  "notifications": [
    {
      "notification_id": "not123",
      "type": 1,
      "category": 1,
      "actors": [
        {
          "user_id": "user456",
          "nickname": "用户昵称",
          "avatar": "https://example.com/avatar.jpg",
          "departments": [{"id": 1, "name": "轻音部"}],
          "is_verified": false
        }
      ],
      "actor_count": 1,
      "title": "赞了你的帖子",
      "content": "",
      "target_id": "post123",
      "target_type": "post",
      "target_preview_image": "https://example.com/cover.jpg",
      "target_summary": "帖子标题...",
      "redirect_url": "/post/post123",
      "is_read": false,
      "created_at": 1733232000
    }
  ],
  "next_page_token": "abc123"
}
```

**调用示例**：
```bash
curl -X GET "http://localhost:8080/api.messenger.v1.MessageService/ListNotifications?category=1&pagination.page_size=10" \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证

##### GetUnreadCount - 获取未读计数

**HTTP 方法和路由**：`GET /api.messenger.v1.MessageService/GetUnreadCount`

**功能**：获取未读计数（用于显示红点）

**是否需要认证**：需要

**请求体字段**：
```json
{}
```

**响应体字段**：
```json
{
  "total": 7,
  "category_interaction": 5,
  "category_comment": 2,
  "category_follow": 0,
  "category_system": 0
}
```

**调用示例**：
```bash
curl -X GET http://localhost:8080/api.messenger.v1.MessageService/GetUnreadCount \
  -H "Authorization: Bearer <token>"
```

**返回码说明**：
- 200：成功
- 401：未认证

##### MarkRead - 标记已读

**HTTP 方法和路由**：`POST /api.messenger.v1.MessageService/MarkRead`

**功能**：标记已读（支持全部/分类/单条）

**是否需要认证**：需要

**请求体字段**：
```json
{
  "scope": 1,
  "category": 1,
  "notification_ids": ["not123"]
}
```

**响应体字段**：
```json
{}
```

**调用示例**：
```bash
curl -X POST http://localhost:8080/api.messenger.v1.MessageService/MarkRead \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": 1,
    "category": 1,
    "notification_ids": ["not123"]
  }'
```

**返回码说明**：
- 200：成功
- 401：未认证
- 400：参数无效

---

## 公共数据类型

### 分页 (Pagination)

```proto
message Pagination {
  int32 page_size = 1;    // 每页数量
  string page_token = 2;  // 游标（用于无限滚动，最后一条数据的id）
  int32 page = 3;         // 页码（用于传统分页，页面偏移量）
}
```

### 部门 (Department 枚举)

```proto
enum Department {
  DEPARTMENT_UNSPECIFIED = 0;     // 未定义，保留
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

### 部门基础元数据 (DepartmentBase)

```proto
message DepartmentBase {
  Department id = 1;      // 枚举 ID
  string name = 2;        // 全称 (如 "轻音部")
  // string icon_url = 3;   // 徽章图标 (SVG/PNG) - 用于个人主页徽章、帖子分区图标
}
```

### 用户摘要 (UserSummary)

```proto
message UserSummary {
  string user_id = 1;
  string nickname = 2; // 昵称，若有备注优先显示备注
  string avatar = 3;
  repeated api.common.v1.DepartmentBase departments = 4; // 所有所属部门徽章
  bool is_verified = 5;              // 身份认证状态
  string verified_title = 6;         // 认证头衔（如：23届部长）
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

### v1.1.0 (2026-02-03)

- 新增用户身份认证申请功能 (ApplyVerification)
- 新增用户管理服务的认证申请列表和审核接口
- 重构用户摘要信息，支持多个部门徽章展示
- 新增部门基础元数据类型 (DepartmentBase)
- 优化API文档结构和内容

### v1.0.0 (2026-02-03)

- 初始化版本
- 包含用户认证、用户管理、社区内容、官网展示、消息通知等核心功能
- 使用 Connect-Go 框架支持 gRPC 和 HTTP/JSON
- 使用 Buf v2 管理 API 定义

---

*最后更新：2026-02-03*
