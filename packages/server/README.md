# Shining ACG 后端服务

Shining ACG 后端是一个基于 Go 语言开发的单体服务系统，为 Shining ACG App 和 Site 提供完整的后端支持。系统采用 Protocol Buffers 定义 API，使用 Connect-Go 框架实现同时支持 gRPC、gRPC-Web 和 HTTP/JSON 三种接口类型。

## 项目特点

- **多协议支持**：同时支持 gRPC、gRPC-Web 和 HTTP/JSON 接口
- **单体服务架构**：采用单体服务架构，便于开发、部署和维护
- **RESTful API 转码**：使用 [Vanguard](https://github.com/connectrpc/vanguard-go) 库自动将 REST 请求转码为 RPC 调用，支持标准的 `google.api.http` 注解
- **高效开发**：使用 Protocol Buffers 和 Buf v2 管理 API 定义，自动生成代码
- **高性能**：使用 PostgreSQL 作为主数据库，Redis 作为缓存
- **现代化工具链**：支持 Docker 容器化部署，Kubernetes 编排

## 架构概览

### 系统架构

```
Client (gRPC/HTTP) → Gateway (Connect-Go) → Monolithic Service
```

### 模块划分

| 模块           | 功能     | 包含服务                                                                          |
|---------------|--------|---------------------------------------------------------------------------------|
| **Account**   | 用户核心功能 | Auth Service（认证）、User Service（用户资料/关系）                                  |
| **Community** | 社区内容功能 | Content Service（帖子/瀑布流）、Interaction Service（转评赞）、Comment Service（评论）  |
| **Messenger** | 消息通知功能 | Message Service（通知管理、互动管理）                                                |
| **CMS**       | 官网管理功能 | CMS Service（官网信息展示）                                                       |
| **Admin**     | 管理后台功能 | UserAdminService（用户管理）、SiteAdminService（官网管理）、GovernanceService（社区治理）、ContentAdminService（内容管理）、SystemAdminService（系统管理） |

### 技术栈

- **语言**：Go 1.21+
- **RPC 框架**：Connect-Go v1.19.1
- **API 定义**：Protocol Buffers 3
- **代码生成**：Buf v2
- **ORM**：GORM v1.25+
- **数据库**：PostgreSQL 15+
- **缓存**：Redis（计划）
- **存储**：Cloudflare R2（计划）
- **资源处理**：FFmpeg v6.0+
- **对象存储**：S3 兼容存储（MinIO/Cloudflare R2）

### 核心资源服务架构

#### Media 资源类型
```proto
// 媒体资源
message Media {
  string id = 1;               // 雪花 ID
  MediaType type = 2;         // 媒体类型：IMAGE/VIDEO
  string bucket = 3;          // 存储桶
  string object_key = 4;      // 对象路径
  MediaMeta meta = 5;         // 元数据（宽高、大小、MIME类型）
  int32 status = 6;           // 状态：0-处理中/1-已完成/2-违规屏蔽/4-处理失败
}
```

#### 资源处理流程

**1. 图片处理**
- **场景分类**：
  - 头像：自动裁剪为 256x256 正方形
  - 帖子图片：压缩为 WebP 格式（最大宽高 1080x1080）
  - 评论图片：压缩为 WebP 格式（最大宽高 800x800）
  - 帖子封面：
    - 用户上传的封面：保持原始宽高比（支持 3:4、4:3、1:1 等比例），直接压缩为 WebP 格式
    - 系统生成的封面：自动裁剪为 3:4 比例（600x800），自适应保留核心内容
- **核心功能**：自动缩放、格式转换、居中裁剪、条件裁剪（根据场景需求）
- **支持格式**：JPEG、PNG、WebP

**2. 视频处理**
- **转码**：H.264 编码，HLS 分片（m4s）
- **分辨率**：720p（1280x720），可配置
- **码率**：视频 1500k，音频 128k
- **分片时长**：6秒
- **格式**：MP4（原始）→ HLS（m3u8 + m4s）
- **封面生成**：
  - 自动从视频第一帧提取原始封面
  - 对原始封面进行自适应裁剪，生成 3:4 比例（600x800）的封面
  - 支持保留核心内容的智能裁剪算法

**3. FFmpeg 处理链**
- **图片压缩**：`ffmpeg -i input -q:v 80 -vf "scale=1080:-2" output.webp`
- **头像裁剪**：`ffmpeg -i input -vf "crop=w:h:x:y,scale=256:256" output.webp`
- **封面裁剪**：`ffmpeg -i input -q:v 80 -vf "crop=w:h:x:y,scale=600:800" output.webp`（自适应裁剪保留核心内容）
- **视频转码**：`ffmpeg -i input -c:v libx264 -c:a aac -hls_time 6 -hls_list_size 0 output.m3u8`
- **视频封面提取**：`ffmpeg -i input -ss 00:00:01 -vframes 1 -q:v 2 output.jpg`（获取第一帧原图）

#### 关键配置参数

**图片处理配置**：
```go
// 头像尺寸
const AvatarWidth = 256
const AvatarHeight = 256

// 帖子图片尺寸
const PostImageMaxWidth = 1080
const PostImageMaxHeight = 1080

// 评论图片尺寸
const CommentImageMaxWidth = 800
const CommentImageMaxHeight = 800

// 帖子封面尺寸（3:4）
const CoverWidth = 600
const CoverHeight = 800
```

**视频处理配置**：
```go
// 转码质量
const VideoBitrate = "1500k"
const AudioBitrate = "128k"
const TargetHeight = 720 // 720p

// HLS 配置
const HLSTime = 6 // 分片时长（秒）
const HLSListSize = 0 // 保留所有分片

// 工作池大小
const WorkerPoolSize = 4 // 并发处理数
```

## 快速开始

### 环境要求

- **开发环境**：Go 1.25.3 或更高版本、Buf CLI、PostgreSQL 15+
- **部署环境**：Docker 20+、Docker Compose 2+

### 本地调试启动

```bash
# 1. 克隆代码
git clone <repo-url>
cd packages/server

# 2. 安装依赖
go mod tidy

# 3. 生成代码
buf generate

# 4. 启动依赖服务
docker-compose up -d

# 5. 启动服务
go run ./cmd
```

### 资源服务 API

服务提供完整的资源处理 API，支持图片、视频的上传和处理：

**1. 获取上传凭证**
```bash
# 获取图片上传凭证
curl -X POST http://localhost:9000/api.common.v1.ResourceService/GetUploadTokens \
  -H "Content-Type: application/json" \
  -d '{
    "scene": 1,
    "tasks": [{"filename": "avatar.jpg", "size_bytes": 1048576, "mime_type": "image/jpeg"}]
  }'

# 获取视频上传凭证
curl -X POST http://localhost:9000/api.common.v1.ResourceService/GetUploadTokens \
  -H "Content-Type: application/json" \
  -d '{
    "scene": 3,
    "tasks": [{"filename": "video.mp4", "size_bytes": 10485760, "mime_type": "video/mp4"}]
  }'
```

**2. 完成上传**
```bash
curl -X POST http://localhost:9000/api.common.v1.ResourceService/CompleteUpload \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "2021626092003004416",
    "scene": 1,
    "object_key": "image/avatar/2021626092003004416.webp"
  }'
```

**3. 查询处理状态**
```bash
curl -X GET "http://localhost:9000/api.common.v1.ResourceService/GetUploadStatus?task_id=2021626092003004416"
```

**场景枚举值：**
- 0: SCENE_UNSPECIFIED（未指定）
- 1: SCENE_USER_AVATAR（用户头像）
- 2: SCENE_POST_IMAGE（帖子图片）
- 3: SCENE_POST_VIDEO（帖子视频）
- 4: SCENE_COMMENT_IMAGE（评论图片）
- 5: SCENE_CHAT_FILE（私聊文件）
- 6: SCENE_POST_COVER（帖子封面）

**CompleteUpload API 新增字段：**
```json
{
  "task_id": "2021626092003004416",
  "scene": 6,
  "object_key": "image/cover/2021626092003004416.jpg",
  "crop_cover": false  // 新增字段
}
```

| 参数名 | 类型 | 说明 |
|--------|------|------|
| crop_cover | boolean | 是否需要裁剪封面（仅适用于 SCENE_POST_COVER 场景）<br>true: 需要裁剪为 3:4 比例（系统生成的封面）<br>false: 保留原始宽高比（用户上传的封面）<br>默认值: false

### 测试工具

项目提供了完整的测试工具：

```bash
# 运行集成测试
go run test/test_upload.go
```

**功能测试：**
1. 本地文件路径输入
2. 场景选择
3. 预签名 URL 获取
4. 文件上传
5. 异步处理通知
6. 状态轮询

**测试图片/视频要求：**
- 测试图片：test/test.jpg（1448x2048）
- 测试视频：test/test.mp4（建议 < 50MB）

```bash
# 登录 (RESTful)
curl -X POST http://localhost:9000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"credential": "your-qq-token", "device": {"device_id": "uuid-123", "device_name": "iPhone 14", "platform": 1, "os_version": "iOS 16.0", "client_version": "1.0.0"}}'

# 获取当前用户信息 (RESTful)
curl -X GET http://localhost:9000/v1/me \
  -H "Authorization: Bearer your-access-token"

# 获取帖子列表 (RESTful)
curl -X GET "http://localhost:9000/v1/posts?scene=1&pagination.page_size=10"

# 关注用户 (RESTful)
curl -X PUT http://localhost:9000/v1/me/following/user-id-123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-token" \
  -d '{"is_active": true}'
```

**使用 ConnectRPC 标准路径（HTTP/JSON）：**

```bash
curl -X POST http://localhost:9000/api.account.v1.AuthService/Login \
  -H "Content-Type: application/json" \
  -d '{"credential": "your-qq-token", "device": {"device_id": "uuid-123", "device_name": "iPhone 14", "platform": 1, "os_version": "iOS 16.0", "client_version": "1.0.0"}}'
```

**使用 gRPC 客户端：**

```bash
grpcurl -plaintext -d '{"credential": "your-qq-token", "device": {"device_id": "uuid-123", "device_name": "iPhone 14", "platform": 1, "os_version": "iOS 16.0", "client_version": "1.0.0"}}' \
  localhost:9000 api.account.v1.AuthService/Login
```

## 开发文档

- **API 文档**：[API-Structure.md](doc/API-Structure.md) - 完整的 API 架构说明，包含 gRPC 和 HTTP 调用文档
- **数据库设计**：[Database-Design.md](doc/Database-Design.md) - 数据库表结构设计
- **产品需求**：[prd.md](doc/prd.md) - 详细的产品需求和功能描述

## 项目结构

```
server/
├── proto/                          # Protocol Buffers 定义
│   └── api/
│       ├── common/v1/             # 公共模块（分页、枚举、媒体类型）
│       ├── account/v1/            # 用户账户模块（认证、用户信息）
│       ├── cms/v1/               # 官网管理模块（展示、后台管理）
│       ├── community/v1/         # 社区模块（内容、互动、评论、治理）
│       ├── messenger/v1/         # 消息通知模块（通知）
│       └── admin/v1/             # 管理后台模块（用户管理、官网管理、社区治理、内容管理、系统管理）
├── gen/                            # 生成的代码
├── cmd/                            # 服务入口
│   └── main.go                   # 主入口文件
├── internal/                       # 内部代码
│   ├── biz/                      # 业务逻辑（Use Case）
│   │   └── resource.go          # 资源处理核心逻辑
│   ├── service/                   # 业务实现
│   │   ├── auth.go               # 认证服务实现
│   │   ├── user.go               # 用户服务实现
│   │   └── resource.go          # 资源服务 API 实现
│   ├── model/                    # 数据模型定义（Entity/Model）
│   │   └── model.go           # 数据库模型定义
│   ├── repo/                     # 数据访问层（Repository 接口与实现）
│   │   ├── db.go             # 数据库连接管理
│   │   └── resource.go       # 资源存储库实现
├── pkg/                           # 公共库
│   ├── ffmpeg/                  # FFmpeg 音视频处理
│   │   ├── ffmpeg.go           # 核心处理函数
│   │   └── worker.go           # 工作池实现
│   ├── pathutil/               # 文件路径工具
│   │   └── pathutil.go        # 路径生成和管理
│   └── s3/                     # S3 对象存储
│       └── s3.go              # S3 客户端实现
├── doc/                           # 文档
├── build/                         # 构建脚本和配置
├── go.mod                         # Go 模块依赖
└── go.sum                         # Go 依赖锁定
```

## 开发流程

1. **需求分析**：确定功能需求和 API 设计
2. **Protobuf 定义**：在 `proto/api/<module>/v1/` 目录下编写 .proto 文件
3. **代码生成**：运行 `buf generate` 生成 Go 代码
4. **业务实现**：在 `internal/service/` 目录下实现业务逻辑
5. **单元测试**：编写单元测试验证功能
6. **集成测试**：部署到测试环境进行集成测试
7. **发布上线**：合并到 main 分支并部署到生产环境

## 贡献指南

1. 请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)（待创建）
2. 从 develop 分支创建功能分支
3. 完成开发后创建 PR 到 develop 分支
4. 代码审查通过后合并

## 许可证

## 联系方式

如有问题或建议，请通过以下方式联系：

- 邮箱：frozenfish233@outlook.com
- QQ群：2058733532

---

*最后更新：2026-02-08*
