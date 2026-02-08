# 第一阶段：编译阶段
FROM golang:1.25-alpine3.22 AS builder

# 安装编译依赖
RUN apk add --no-cache \
    git \
    gcc \
    musl-dev \
    protoc \
    make

# 设置工作目录
WORKDIR /app

# 复制 go 模块文件
COPY go.mod go.sum ./
RUN go mod download

# 复制项目文件
COPY . .

# 确保 proto 文件已生成代码（使用 buf）
RUN if command -v buf >/dev/null 2>&1; then \
        echo "buf found, generating proto code..."; \
        cd proto && buf generate; \
    else \
        echo "buf not found, checking if proto code already exists..."; \
        if [ ! -d "gen/proto" ]; then \
            echo "Error: proto code not found. Please run 'buf generate' first"; \
            exit 1; \
        fi; \
    fi

# 编译服务（单体服务）
RUN cd cmd && go build -v -o /app/server

# 第二阶段：运行阶段
FROM alpine:3.20

# 安装运行依赖
RUN apk add --no-cache \
    ca-certificates

# 创建非 root 用户
RUN addgroup -g 1001 -S shining && \
    adduser -u 1001 -S shining -G shining

# 设置工作目录
WORKDIR /app

# 从编译阶段复制二进制文件
COPY --from=builder /app/server .

# 确保日志目录可写
RUN mkdir -p /app/logs && chown -R shining:shining /app

# 切换用户
USER shining

# 暴露端口
EXPOSE 8080

# 启动服务
CMD ["./server"]
