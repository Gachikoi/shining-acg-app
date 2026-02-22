//go:build wireinject
// +build wireinject

package main

import (
	"app.shiningacg.club/config"
	"app.shiningacg.club/internal/biz"
	"app.shiningacg.club/internal/repo"
	"app.shiningacg.club/internal/service"
	"app.shiningacg.club/pkg/ffmpeg"
	"github.com/bwmarrin/snowflake"
	"github.com/google/wire"
)

// DataProviderSet 数据层依赖注入集合
var DataProviderSet = wire.NewSet(
	repo.NewDB,
	repo.NewResourceRepo,
	wire.Bind(new(repo.ResourceRepo), new(*repo.ResourceRepoImpl)),
)

// BizProviderSet 业务逻辑层依赖注入集合
var BizProviderSet = wire.NewSet(
	biz.NewResourceUseCase,
)

// ServiceProviderSet 服务层依赖注入集合
var ServiceProviderSet = wire.NewSet(
	service.NewResourceServiceServer,
)

// SnowflakeProvider 雪花算法节点提供者
func NewSnowflakeNode(cfg *config.Config) (*snowflake.Node, error) {
	return snowflake.NewNode(cfg.Snowflake.NodeID)
}

// S3ClientProvider S3 客户端提供者
func NewS3Client(cfg *config.Config) (*biz.S3Client, error) {
	return biz.NewS3Client(
		cfg.OSS.Internal.Endpoint,
		cfg.OSS.Internal.UseSSL,
		cfg.OSS.External.Endpoint,
		cfg.OSS.External.UseSSL,
		cfg.OSS.AccessKey,
		cfg.OSS.SecretKey,
		cfg.OSS.Bucket,
	)
}

// FFmpegWorkerPoolProvider FFmpeg 工作池提供者
func NewFFmpegWorkerPool(cfg *config.Config) (*ffmpeg.WorkerPool, error) {
	pool := ffmpeg.NewWorkerPool(cfg.FFmpeg.MaxWorkers, cfg.FFmpeg.QueueSize)
	pool.Start()
	return pool, nil
}

// InitializeApp 初始化应用程序依赖
func InitializeApp(cfg *config.Config) (*App, func(), error) {
	wire.Build(
		// 外部依赖
		NewS3Client,
		NewSnowflakeNode,
		NewFFmpegWorkerPool,

		// 数据层
		DataProviderSet,

		// 业务层
		BizProviderSet,

		// 服务层
		ServiceProviderSet,

		// 应用程序实例
		NewApp,
	)
	return nil, nil, nil
}
