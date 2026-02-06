package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"app.shiningacg.club/gen/proto/api/account/v1/accountv1connect"
	"app.shiningacg.club/pkg/interceptor"
	"app.shiningacg.club/service/account/internal/service"
	"connectrpc.com/vanguard"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	// 创建服务实例
	authPath, authHandler := accountv1connect.NewAuthServiceHandler(&service.AuthServiceServer{})
	userPath, userHandler := accountv1connect.NewUserServiceHandler(&service.UserServiceServer{})

	// 创建 Vanguard 服务配置
	// 这些服务将同时支持 ConnectRPC 标准路径和 RESTful API 路径
	services := []*vanguard.Service{
		vanguard.NewService(authPath, authHandler),
		vanguard.NewService(userPath, userHandler),
	}

	// 创建 Vanguard Transcoder
	// 它会自动处理:
	// 1. Connect 协议请求 (如 POST /api.account.v1.AuthService/Login)
	// 2. REST 请求 (如 POST /v1/auth/login)，根据 proto 文件中的 google.api.http 注解
	transcoder, err := vanguard.NewTranscoder(services)
	if err != nil {
		log.Fatalf("创建 Vanguard Transcoder 失败: %v", err)
	}

	// 构建中间件链
	var handler http.Handler = transcoder
	handler = interceptor.LoggerInterceptor(handler)
	handler = interceptor.ErrorInterceptor(handler)
	handler = h2c.NewHandler(handler, &http2.Server{}) // 支持 h2c

	// 获取监听地址
	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	fmt.Printf("AuthService registered at prefix: %s\n", authPath)
	fmt.Printf("UserService registered at prefix: %s\n", userPath)
	fmt.Println("\n支持的访问方式:")
	fmt.Println("  - ConnectRPC: POST /api.account.v1.AuthService/Login")
	fmt.Println("  - RESTful:    POST /v1/auth/login")
	fmt.Printf("\n服务启动于 %s\n", addr)

	// 启动服务器
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
