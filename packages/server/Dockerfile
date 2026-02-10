# 第一阶段：编译阶段
FROM golang:1.25-alpine3.22 AS builder

# 设置构建环境变量
ENV GO111MODULE=on \
    GOPROXY=https://goproxy.cn,direct \
    CGO_ENABLED=0 \
    GOOS=linux

# 安装必要工具
# 移除了 git 和 make，除非你的构建脚本(如 Makefile) 必须用到
RUN apk add --no-cache git protobuf-dev

# 安装 buf (确保构建环境具备生成能力)
RUN go install github.com/bufbuild/buf/cmd/buf@latest

WORKDIR /app

# 1. 缓存依赖项
COPY go.mod go.sum ./
RUN go mod download

# 2. 复制项目文件
COPY . .

# 3. 生成代码
# 直接运行 buf generate，如果失败则构建停止，保证代码一致性
RUN cd proto && buf generate

# 4. 编译
# -s: 去掉符号表; -w: 去掉调试信息。能缩小约 20%-30% 的体积
RUN go build -ldflags="-s -w" -o /app/server ./cmd/main.go

# 第二阶段：运行阶段
FROM alpine:3.20

# 安装运行依赖
RUN apk add --no-cache \
    ca-certificates ffmpeg

# 创建非 root 用户
RUN addgroup -g 1001 -S shining && \
    adduser -u 1001 -S shining -G shining

# 设置工作目录
WORKDIR /app

# 从编译阶段复制二进制文件
COPY --from=builder --chown=shining:shining /app/server .

# 确保日志目录可写
RUN mkdir -p /app/logs && chown -R shining:shining /app

# 切换用户
USER shining

# 暴露端口
EXPOSE 8080

# 启动服务
ENTRYPOINT ["./server"]
