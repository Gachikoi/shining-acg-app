package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"app.shiningacg.club/config"
	"app.shiningacg.club/pkg/logger"
)

func main() {
	// 加载配置
	cfg, err := config.LoadConfig("")
	if err != nil {
		logger.Init("info") // 初始化默认日志配置
		slog.Error("加载配置失败", slog.Any("error", err))
		os.Exit(1)
	}

	// 初始化日志系统
	logger.Init(cfg.Log.Level)
	slog.Info("日志系统初始化成功", slog.String("log_level", cfg.Log.Level))

	// 使用 Wire 进行依赖注入
	app, cleanup, err := InitializeApp(cfg)
	if err != nil {
		slog.Error("初始化应用程序失败", slog.Any("error", err))
		os.Exit(1)
	}
	defer cleanup()

	// 设置信号处理
	ctx, cancel := context.WithCancel(context.Background())
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 启动服务器
	go func() {
		slog.Info("服务启动", slog.String("server_addr", app.ServerAddr))
		if err := app.Run(); err != nil {
			slog.Error("服务启动失败", slog.Any("error", err))
			os.Exit(1)
		}
	}()

	// 等待中断信号
	select {
	case <-sigChan:
		slog.Info("正在停止服务...")
		cancel()
		app.Stop() // 停止 WorkerPool
		slog.Info("服务已停止")
	case <-ctx.Done():
		app.Stop()
	}
}
