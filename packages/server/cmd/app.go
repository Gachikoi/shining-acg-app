package main

import (
	"app.shiningacg.club/config"
	"app.shiningacg.club/gen/proto/api/main/partition/v1/partitionv1connect"

	//accountv1connect "app.shiningacg.club/gen/proto/api/account/v1/accountv1connect"
	//commonv1connect "app.shiningacg.club/gen/proto/api/common/v1/commonv1connect"
	"net/http"

	"app.shiningacg.club/internal/service"
	"app.shiningacg.club/pkg/ffmpeg"
	"app.shiningacg.club/pkg/interceptor"
	"connectrpc.com/vanguard"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

// App 应用程序实例
type App struct {
	ServerAddr string
	Handler    http.Handler
	pool       *ffmpeg.WorkerPool
}

// NewApp 创建应用程序实例
func NewApp(
	cfg *config.Config,
	resourceService *service.ResourceServiceServer,
	pool *ffmpeg.WorkerPool,
) (*App, error) {

	// 创建服务实例
	//authPath, authHandler := accountv1connect.NewAuthServiceHandler(&service.AuthServiceServer{})
	//userPath, userHandler := accountv1connect.NewUserServiceHandler(&service.UserServiceServer{})
	//resourcePath, resourceHandler := commonv1connect.NewResourceServiceHandler(resourceService)
	partitionPath, partitionHandler := partitionv1connect.NewPartitionServiceHandler(&service.PartitionServiceServer{})

	// 创建 Vanguard 服务配置
	services := []*vanguard.Service{
		//vanguard.NewService(authPath, authHandler),
		//vanguard.NewService(userPath, userHandler),
		//vanguard.NewService(resourcePath, resourceHandler),
		vanguard.NewService(partitionPath, partitionHandler),
	}

	// 创建 Vanguard Transcoder
	transcoder, err := vanguard.NewTranscoder(services)
	if err != nil {
		return nil, err
	}

	// 构建中间件链
	var handler http.Handler = transcoder
	handler = interceptor.TracingInterceptor(handler)
	handler = interceptor.ErrorInterceptor(handler)
	handler = h2c.NewHandler(handler, &http2.Server{}) // 支持 h2c

	// 获取监听地址
	addr := ":" + cfg.Server.Port

	return &App{
		ServerAddr: addr,
		Handler:    handler,
		pool:       pool,
	}, nil
}

// Run 启动应用程序
func (a *App) Run() error {
	return http.ListenAndServe(a.ServerAddr, a.Handler)
}

// Stop 停止应用程序
func (a *App) Stop() {
	if a.pool != nil {
		a.pool.Stop()
	}
}
