这份重写的 README.md 旨在提供清晰的**项目全景**、**开发指引**以及**基础设施说明**。我已根据你提供的文件结构、Docker 配置、CI/CD 流程和 Nginx 配置进行了深度整合。

---

# Shining ACG Server

[![Go Version](https://img.shields.io/badge/Go-1.25.3-blue.svg)](https://golang.org/doc/go1.25)
[![Build Status](https://img.shields.io/github/actions/workflow/status/your_username/shining-acg-app/ci.yaml?branch=develop)](https://github.com/your_username/shining-acg-app/actions)

Shining ACG 后端服务是一个基于 **Go** 语言开发的单体服务（Monolithic），采用 **Connect-Go** 框架同时支持 gRPC 和 HTTP/JSON 接口。项目集成了现代化基础设施，包括 MinIO 对象存储、PostgreSQL 数据库以及基于 Loki 的日志监控系统。

## 📚 目录

- [技术栈与工具](#-技术栈与工具)
- [项目结构](#-项目结构)
  - [internal 目录约定](#internal-目录约定)
- [快速开始 (本地开发)](#-快速开始-本地开发)
  - [环境准备](#1-环境准备)
  - [启动基础设施](#2-启动基础设施)
  - [运行服务](#3-运行服务)
- [开发工作流](#-开发工作流)
  - [API 定义 (Buf)](#api-定义-buf)
  - [依赖注入 (Wire)](#依赖注入-wire)
- [部署架构](#-部署架构)
  - [基础设施层](#基础设施层)
  - [CI/CD 流程](#cicd-流程)
  - [网关配置 (Nginx)](#网关配置-nginx)
- [可观测性](#-可观测性)

---

## 🛠 技术栈与工具

为了保证高性能与开发效率，本项目选用了以下核心技术栈：

| 类别 | 技术/工具 | 版本/说明 |
| :--- | :--- | :--- |
| **语言** | **Go** | `1.25.3` |
| **RPC 框架** | **Connect-Go** | 支持 gRPC, gRPC-Web, HTTP/1.1 |
| **API 管理** | **Buf** | 替代 `protoc`，用于 Lint、格式化及代码生成 |
| **依赖注入** | **Google Wire** | 编译期依赖注入，避免反射带来的性能损耗 |
| **数据库** | **PostgreSQL** | `17-alpine` |
| **对象存储** | **MinIO** | S3 兼容存储，用于图片/视频存储 |
| **媒体处理** | **FFmpeg** | 视频转码 (HLS)、封面截取、图片压缩 |
| **日志监控** | **PLG Stack** | Promtail (采集) + Loki (存储) + Grafana (展示) |
| **容器化** | **Docker** | 开发与生产环境的一致性保证 |

---

## 📂 项目结构

遵循标准的 Go 项目布局（Standard Go Project Layout）：

```text
packages/server
├── cmd/                # 程序入口
│   ├── main.go         # 主程序
│   └── wire.go         # 依赖注入定义 (运行 wire 生成 wire_gen.go)
├── config/             # 配置结构定义
├── internal/           # 私有业务代码 (不对外暴露)，分层约定见下文
│   ├── biz/            # 按 proto 中的服务边界划分的用例层 (Use Case)
│   │   ├── feed/       # 示例：与 Feed 相关 RPC 对应的业务编排
│   │   │   └── repo/   # 可选：仅被本边界使用的查询/持久化实现
│   │   └── media/      # 示例：与 Media 相关 RPC 对应的业务编排
│   ├── model/          # 数据库实体与表结构映射 (GORM Model 等)
│   ├── repo/           # 跨多个 biz 复用的仓储 (按表/聚合划分，而非按 RPC)
│   └── service/        # Connect/gRPC 服务实现层 (薄适配：proto ↔ biz)
├── pkg/                # 公共库 (可被外部引用)
│   ├── ffmpeg/         # 音视频处理封装
│   ├── logger/         # 基于 slog 的日志封装
│   └── s3/             # MinIO/S3 客户端封装
├── proto/              # Protobuf 定义文件
├── gen/                # Buf 自动生成的 Go 代码 (勿手动修改)
├── script/             # 辅助脚本
└── docker-compose.yml  # 本地开发基础设施编排
```

### internal 目录约定

本服务的 `internal` 按 **依赖由外向内** 组织：`service` → `biz` → `repo`（及可选的 `biz/<边界>/repo`）→ `model`。`proto/` 描述对外契约，**不必**在文件系统上逐文件镜像 proto 树；与 **RPC Service** 对齐的是 `service` 中的 Handler 与 `biz` 下的边界包名。

| 路径 | 职责 |
| :--- | :--- |
| `internal/service` | 实现 proto 中定义的各 `Service`（Connect Handler）。负责请求/响应与内部类型的映射，**不写复杂业务与 SQL**。 |
| `internal/biz/<边界>` | 与 proto 中的服务/能力边界对应（如 `feed`、`media`），编排用例、领域规则，依赖下层 `repo` 接口。 |
| `internal/repo` | 多个 `biz` 包都会访问的表或聚合的仓储实现（例如用户、帖子等共享数据）。按 **数据归属** 拆分文件或子包，而非按单个 RPC 服务拆分。 |
| `internal/model` | 与数据库表（或持久化形态）对应的类型定义；尽量保持为「结构 + 约束」，复杂规则放在 `biz`。 |
| `internal/biz/<边界>/repo` | **仅当**某类查询或持久化逻辑 **只服务于该边界** 时使用（例如 Feed 时间线专用 SQL）。若同一表日后被多个 `biz` 使用，应上提到 `internal/repo` 并对外暴露接口。 |

新增 RPC 服务时的推荐顺序：在 `proto/` 定义契约并 `buf generate` → 在 `internal/service` 增加 Handler → 在 `internal/biz/<边界>` 实现用例 → 按需补充 `internal/repo` 或 `internal/biz/<边界>/repo` → 在 `cmd/wire.go` 中注册依赖。

---

## 🚀 快速开始 (本地开发)

### 1. 环境准备

确保本地已安装以下工具：
- **Go** (1.25+)
- **Docker** & **Docker Compose**
- **Buf CLI** (用于处理 Proto)
- **Wire** (`go install github.com/google/wire/cmd/wire@latest`)

### 2. 启动基础设施

在 `packages/server` 目录下，使用 Docker Compose 启动数据库、对象存储和日志系统：

```bash
docker compose up -d
```

这将启动以下服务：
- **PostgreSQL**: 端口 `5433` (映射到宿主机，避免冲突)
- **MinIO**: API 端口 `9000`, 控制台端口 `9001`
- **Loki/Promtail/Grafana**: 访问 `localhost:3000` 查看日志 (User/Pass: admin/admin)

### 3. 运行服务

复制并检查配置文件（通常本地开发直接使用默认即可）：

```bash
# 确保依赖已下载
go mod tidy

# 启动服务
go run ./cmd
```

服务启动后默认监听端口见 `config.yaml` (通常为 `:8000`)。

---

## 💻 开发工作流

### API 定义 (Buf)

我们使用 Protobuf 定义 API 契约。当你修改了 `proto/` 目录下的 `.proto` 文件后：

1.  **删除旧代码**：推荐先清理 `gen/` 目录。
2.  **生成新代码**：
    ```bash
    cd proto
    buf generate
    ```
    *注意：CI 流程会检查生成的代码是否与 Proto 定义同步，请务必提交 `gen/` 目录的变更。*

### 依赖注入 (Wire)

项目使用 `google/wire` 进行依赖管理。当你添加了新的 Service、Repo 或修改了初始化依赖关系（`cmd/wire.go`）后：

```bash
cd cmd
wire
```
这将重新生成 `wire_gen.go` 文件。

---

## 🏗 部署架构

服务器环境分为 **Dev (开发/测试)** 和 **Prod (生产)**，两者并存但在网络和存储上物理隔离。

### 基础设施层

- **反向代理 (Nginx)**: 作为统一网关，负责 SSL 卸载、域名路由和请求头转发。
- **容器编排**: 使用 `docker compose` 管理服务生命周期。
- **存储**:
  - 数据库数据挂载于宿主机 `/mnt/storage/...`
  - 日志数据通过 Loki 持久化。

### CI/CD 流程

基于 **GitHub Actions** (`ci.yaml`) 实现自动化：

1.  **代码变更检测**: 仅当 `packages/server` 变动时触发后端流水线。
2.  **代码检查**: 执行 `buf generate` 校验、Go Format 检查、编译测试。
3.  **构建镜像**:
  - `develop` 分支 -> `ghcr.io/.../server:develop`
  - `main` / `tags` -> `ghcr.io/.../server:latest` & `:version`
4.  **自动部署**:
  - SSH 连接到服务器。
  - 拉取最新镜像 (`docker compose pull`)。
  - 无宕机滚动更新 (`docker compose up -d --no-deps`).

### 网关配置 (Nginx)

服务器上的 Nginx 配置 (`/opt/nginx_gateway/conf.d/shining.conf`) 负责流量分发：

- **test.api.shiningacg.club** -> 转发至 **Dev** 容器 (`api-dev:8000`)
- **api.shiningacg.club** -> 转发至 **Prod** 容器 (`api-prod:8000`)
- **/shining-bucket/** -> 转发至 MinIO，用于直接访问媒体资源。

---

## 📊 可观测性

系统内置了完整的日志追踪链路：

1.  **日志生成**: 应用使用 `slog` + `TraceID` 记录结构化日志。
2.  **日志采集**: `Promtail` 挂载 Docker 容器日志目录，实时采集标准输出。
3.  **日志存储**: 推送至 `Loki` 进行索引和存储。
4.  **可视化**: 通过 `Grafana` (本地端口 3000) 进行查询和展示。

**Trace ID 穿透**:
TracingInterceptor 拦截器生成或透传 `X-Trace-ID` -> Go Middleware 注入 Context -> 日志中包含 `trace_id` 字段，实现全链路追踪。

---

## 📝 贡献指南

1.  Fork 本仓库。
2.  创建特性分支 (`git checkout -b feature/AmazingFeature`)。
3.  提交更改 (`git commit -m 'Add some AmazingFeature'`)。
4.  如果是 Proto 变更，确保运行了 `buf generate`。
5.  如果是依赖变更，确保运行了 `wire`。
6.  推送到分支 (`git push origin feature/AmazingFeature`)。
7.  提交 Pull Request。