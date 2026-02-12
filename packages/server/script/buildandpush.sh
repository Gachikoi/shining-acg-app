#!/bin/bash

# --- 配置区域 ---
USERNAME="gachikoi"
IMAGE_NAME="shining-acg-app"
TAG="develop"
REGISTRY="ghcr.io"
FULL_IMAGE_NAME="$REGISTRY/$USERNAME/$IMAGE_NAME:$TAG" # ${USERNAME,,} 确保用户名转为小写

# --- 1. 构建镜像 ---
echo "🚀 开始构建镜像: $FULL_IMAGE_NAME..."
docker build -t "$FULL_IMAGE_NAME" .

if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请检查 Dockerfile。"
    exit 1
fi

## --- 2. 本地运行测试 (可选) ---
#echo "🔍 正在启动本地容器进行测试..."
## 停止并删除同名的旧容器（如果存在）
#docker rm -f "${IMAGE_NAME}-test" > /dev/null 2>&1
#
## 启动新容器
#docker run -d --name "${IMAGE_NAME}-test" $FULL_IMAGE_NAME
#
#echo "------------------------------------------"
#echo "容器已在后台启动。你可以执行以下命令查看日志："
#echo "docker logs -f ${IMAGE_NAME}-test"
#echo "------------------------------------------"

# --- 3. 确认是否推送 ---
echo -n "❓ 本地调试通过了吗？是否推送至 ghcr? (y/n): "
read confirm

if [[ "$confirm" == [yY] || "$confirm" == [yY][eE][sS] ]]; then
    echo "⬆️ 正在推送到 GHCR..."
    docker push "$FULL_IMAGE_NAME"
    echo "✅ 推送完成！"
else
    echo "🛑 已取消推送。镜像保留在本地供调试。"
fi