package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"app.shiningacg.club/config"
)

func main() {
	// 加载配置
	cfg, err := config.LoadConfig("")
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 使用 Wire 进行依赖注入
	app, cleanup, err := InitializeApp(cfg)
	if err != nil {
		log.Fatalf("初始化应用程序失败: %v", err)
	}
	defer cleanup()

	// 设置信号处理
	ctx, cancel := context.WithCancel(context.Background())
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 启动服务器
	go func() {
		fmt.Printf("服务启动于 %s\n", app.ServerAddr)
		if err := app.Run(); err != nil {
			log.Fatalf("服务启动失败: %v", err)
		}
	}()

	// 等待中断信号
	select {
	case <-sigChan:
		fmt.Println("正在停止服务...")
		cancel()
		app.Stop() // 停止 WorkerPool
		fmt.Println("服务已停止")
	case <-ctx.Done():
		app.Stop()
	}
}
