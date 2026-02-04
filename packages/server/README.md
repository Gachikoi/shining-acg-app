# Shining ACG 后端服务

Shining ACG 后端是一个基于 Go 语言开发的微服务架构系统，为 Shining ACG App 和 Site 提供完整的后端支持。系统采用 Protocol Buffers 定义 API，使用 Connect-Go 框架实现同时支持 gRPC、gRPC-Web 和 HTTP/JSON 三种接口类型。

## 项目特点

- **多协议支持**：同时支持 gRPC、gRPC-Web 和 HTTP/JSON 接口
- **微服务架构**：将系统划分为 Account、Community、Messenger 和 CMS 四个物理微服务
- **高效开发**：使用 Protocol Buffers 和 Buf v2 管理 API 定义，自动生成代码
- **高性能**：使用 PostgreSQL 作为主数据库，Redis 作为缓存
- **现代化工具链**：支持 Docker 容器化部署，Kubernetes 编排

## 架构概览

### 微服务划分

| 微服务           | 功能     | 包含模块                                                                           |
|---------------|--------|--------------------------------------------------------------------------------|
| **Account**   | 用户核心功能 | Auth Service（认证）、User Service（用户资料/关系）                                         |
| **Community** | 社区内容功能 | Content Service（帖子/瀑布流）、Interaction Service（转评赞）、Comment Service（评论）           |
| **Messenger** | 消息通知功能 | Message Service（通知管理、互动管理）                                                     |
| **CMS**       | 官网管理功能 | CMS Service（官网信息展示）                                                            |
| **Admin**     | 管理员功能  | Governance Service（社区治理/审核）、UserAdmin Service（权限/封禁）、SiteAdmin Service（官网后台管理） |


### 技术栈

- **语言**：Go 1.21+
- **RPC 框架**：Connect-Go v1.19.1
- **API 定义**：Protocol Buffers 3
- **代码生成**：Buf v2
- **ORM**：GORM v1.25+
- **数据库**：PostgreSQL 15+
- **缓存**：Redis（计划）
- **存储**：Cloudflare R2（计划）

## 快速开始

### 环境要求

- **开发环境**：Go 1.25.3 或更高版本、Buf CLI、PostgreSQL 15+
- **部署环境**：Docker 20+、Docker Compose 2+

### 快速启动（Docker Compose）

```bash
# 1. 克隆代码
git clone <repo-url>
cd packages/server

# 2. 使用 Docker Compose 启动所有服务
docker-compose up -d

# 3. 检查服务状态
docker-compose ps

# 4. 查看服务日志
docker-compose logs -f <service-name>

# 5. 停止服务
docker-compose down

# 6. 停止服务并清理数据卷
docker-compose down -v
```

### 开发模式（本地启动）

```bash
# 1. 克隆代码
git clone <repo-url>
cd packages/server

# 2. 安装依赖
go mod tidy

# 3. 生成代码
buf generate

# 4. 配置数据库（需要本地安装 PostgreSQL 和 Redis）
# 请参考 DEVELOPMENT.md 中的详细说明

# 5. 启动服务（以 Account 服务为例）
cd service/account/cmd
go run main.go
```

### 测试 API

**使用 curl（HTTP/JSON）：**
```bash
curl -X POST http://localhost:8080/api.account.v1.AuthService/Login \
  -H "Content-Type: application/json" \
  -d '{"type": 1, "credential": "your-qq-token", "device": {"device_type": "mobile", "device_name": "iPhone 14", "os_version": "iOS 16.0", "client_version": "1.0.0"}}'
```

**使用 gRPC 客户端：**
```bash
grpcurl -plaintext -d '{"type": 1, "credential": "your-qq-token", "device": {"device_type": "mobile", "device_name": "iPhone 14", "os_version": "iOS 16.0", "client_version": "1.0.0"}}' \
  localhost:8080 api.account.v1.AuthService/Login
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
│       ├── account/v1/            # 用户账户模块（认证、用户信息、权限）
│       ├── cms/v1/               # 官网管理模块（展示、后台管理）
│       ├── community/v1/         # 社区模块（内容、互动、评论、治理）
│       └── messenger/v1/         # 消息通知模块（通知）
├── gen/                            # 生成的代码
├── service/                        # 微服务实现
│   ├── account/                    # Account 微服务
│   │   ├── cmd/                   # 服务入口
│   │   └── internal/
│   │       ├── interceptor/       # 拦截器
│   │       └── service/           # 业务逻辑实现
│   ├── community/                 # Community 微服务（待实现）
│   └── messenger/                 # Messenger 微服务（待实现）
├── pkg/                           # 公共库（拦截器、工具等）
├── doc/                           # 文档
├── build/                         # 构建脚本和配置
├── go.mod                         # Go 模块依赖
└── go.sum                         # Go 依赖锁定
```

## 开发流程

1. **需求分析**：确定功能需求和 API 设计
2. **Protobuf 定义**：在 `proto/api/<module>/v1/` 目录下编写 .proto 文件
3. **代码生成**：运行 `buf generate` 生成 Go 代码
4. **业务实现**：在对应的微服务目录下实现业务逻辑
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

*最后更新：2026-02-03*
