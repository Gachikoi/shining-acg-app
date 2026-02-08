package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"app.shiningacg.club/gen/proto/api/account/v1/accountv1connect"
	"app.shiningacg.club/gen/proto/api/admin/v1/adminv1connect"
	"app.shiningacg.club/internal/service"
	"app.shiningacg.club/pkg/interceptor"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	// 创建服务实例（这里使用默认实现，实际应该替换为业务实现）
	authPath, authHandler := accountv1connect.NewAuthServiceHandler(&service.AuthServiceServer{})
	userPath, userHandler := accountv1connect.NewUserServiceHandler(&service.UserServiceServer{})
	userAdminPath, userAdminHandler := adminv1connect.NewUserAdminServiceHandler(&service.UserAdminServiceServer{})
	siteAdminPath, siteAdminHandler := adminv1connect.NewSiteAdminServiceHandler(&service.SiteAdminServiceServer{})
	governancePath, governanceHandler := adminv1connect.NewGovernanceServiceHandler(&service.GovernanceServiceServer{})
	contentAdminPath, contentAdminHandler := adminv1connect.NewContentAdminServiceHandler(&service.ContentAdminServiceServer{})
	systemAdminPath, systemAdminHandler := adminv1connect.NewSystemAdminServiceHandler(&service.SystemAdminServiceServer{})

	// 创建 HTTP 服务器 mux
	mux := http.NewServeMux()

	// 注册服务
	mux.Handle(authPath, authHandler)
	mux.Handle(userPath, userHandler)
	mux.Handle(userAdminPath, userAdminHandler)
	mux.Handle(siteAdminPath, siteAdminHandler)
	mux.Handle(governancePath, governanceHandler)
	mux.Handle(contentAdminPath, contentAdminHandler)
	mux.Handle(systemAdminPath, systemAdminHandler)

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
	fmt.Printf("UserAdminService registered at prefix: %s\n", userAdminPath)
	fmt.Printf("SiteAdminService registered at prefix: %s\n", siteAdminPath)
	fmt.Printf("GovernanceService registered at prefix: %s\n", governancePath)
	fmt.Printf("ContentAdminService registered at prefix: %s\n", contentAdminPath)
	fmt.Printf("SystemAdminService registered at prefix: %s\n", systemAdminPath)

	// 启动服务器
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
