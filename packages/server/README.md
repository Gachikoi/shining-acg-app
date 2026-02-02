# Shining ACG 后端服务

Shining ACG 后端是一个基于 Go 语言开发的微服务架构系统，为 Shining ACG App 和 Site 提供完整的后端支持。系统采用 Protocol Buffers 定义 API，使用 Connect-Go 框架实现同时支持 gRPC、gRPC-Web 和 HTTP/JSON 三种接口类型。

## 项目特点

- **多协议支持**：同时支持 gRPC、gRPC-Web 和 HTTP/JSON 接口
- **微服务架构**：将系统划分为 User Core、Community 和 Messenger 三个物理微服务
- **高效开发**：使用 Protocol Buffers 和 Buf 管理 API 定义，自动生成代码
- **高性能**：使用 PostgreSQL 作为主数据库，Redis 作为缓存
- **现代化工具链**：支持 Docker 容器化部署，Kubernetes 编排

## 架构概览

### 微服务划分

| 微服务 | 功能 | 包含模块 |
|------|------|----------|
| **User Core** | 用户核心功能 | Auth Service（认证）、User Service（用户资料/关系）、Admin Service（权限/封禁） |
| **Community** | 社区内容功能 | Content Service（帖子/瀑布流）、Interaction Service（转评赞）、Site Service（官网数据）、Resource Service（资源上传） |
| **Messenger** | 即时通讯功能 | Message Service（私信/聊天）、Notification Service（消息推送） |

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

- Go 1.21 或更高版本
- Buf CLI
- PostgreSQL 15 或更高版本

### 安装步骤

```bash
# 1. 克隆代码
git clone <repo-url>
cd packages/server

# 2. 安装依赖
go mod tidy

# 3. 生成代码
cd proto
buf generate
cd ..

# 4. 配置数据库
# 请参考 DEVELOPMENT.md 中的详细说明

# 5. 启动服务
cd user/cmd/server
go run main.go
```

### 测试 API

**使用 curl（HTTP/JSON）：**
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"qq_access_token": "your-qq-token", "device_info": "test-device"}'
```

**使用 gRPC 客户端：**
```bash
grpcurl -plaintext -d '{"qq_access_token": "your-qq-token", "device_info": "test-device"}' \
  localhost:8080 api.v1.AuthService/Login
```

## 开发文档

- **API 文档**：[API-Structure.md](doc/API-Structure.md) - 完整的 API 架构说明
- **产品需求**：[prd.md](doc/prd.md) - 详细的产品需求和功能描述

## 项目结构

```
server/
├── proto/                          # Protocol Buffers 定义
│   └── api/v1/
│       ├── common/                # 公共模块
│       ├── community/             # 社区内容模块
│       ├── messenger/             # 即时通讯模块
│       └── user/                  # 用户核心模块
├── gen/                            # 生成的代码
├── service/                        # 微服务实现
│   ├── user/                      # User Core 微服务
│   │   ├── cmd/                   # 服务入口
│   │   └── internal/
│   │       ├── interceptor/       # 拦截器
│   │       └── service/           # 业务逻辑实现
│   ├── community/                 # Community 微服务（待实现）
│   └── messenger/                 # Messenger 微服务（待实现）
├── doc/                           # 文档
├── build/                         # 构建脚本和配置
├── go.mod                         # Go 模块依赖
└── go.sum                         # Go 依赖锁定
```

## 开发流程

1. **需求分析**：确定功能需求和 API 设计
2. **Protobuf 定义**：在 `proto/api/v1/` 目录下编写 .proto 文件
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

*最后更新：2026-02-02*
