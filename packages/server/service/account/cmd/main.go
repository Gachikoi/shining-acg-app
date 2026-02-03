package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"app.shiningacg.club/gen/proto/api/account/v1/accountv1connect"
	"app.shiningacg.club/pkg/interceptor"
	"app.shiningacg.club/service/account/internal/service"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	// 创建服务实例（这里使用默认实现，实际应该替换为业务实现）
	authPath, authHandler := accountv1connect.NewAuthServiceHandler(&service.AuthServiceServer{})
	userPath, userHandler := accountv1connect.NewUserServiceHandler(&service.UserServiceServer{})

	// 创建 HTTP 服务器 mux
	mux := http.NewServeMux()

	// 注册服务
	mux.Handle(authPath, authHandler)
	mux.Handle(userPath, userHandler)

	// 构建中间件链
	var handler http.Handler = mux
	//handler = interceptor.CORSInterceptor(handler)
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

	// 启动服务器
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
