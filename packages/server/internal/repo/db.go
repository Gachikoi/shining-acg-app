package repo

import (
	"time"

	"app.shiningacg.club/config"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/pkg/logger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// NewDB 创建数据库连接
func NewDB(cfg *config.Config) (*gorm.DB, error) {
	// 根据配置设置 GORM 日志级别
	var logLevel gormlogger.LogLevel
	switch cfg.Log.Level {
	case "debug":
		logLevel = gormlogger.Info
	case "info":
		logLevel = gormlogger.Info
	case "warn":
		logLevel = gormlogger.Warn
	case "error":
		logLevel = gormlogger.Error
	default:
		logLevel = gormlogger.Info
	}

	db, err := gorm.Open(postgres.Open(cfg.GetDBConnectionString()), &gorm.Config{
		Logger: logger.NewGormLogger(logLevel),
	})
	if err != nil {
		return nil, err
	}

	// 自动迁移数据库
	err = db.AutoMigrate(&model.Media{})
	if err != nil {
		return nil, err
	}

	// 配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// SetMaxIdleConns 设置空闲连接池中连接的最大数量
	sqlDB.SetMaxIdleConns(10)

	// SetMaxOpenConns 设置打开数据库连接的最大数量
	sqlDB.SetMaxOpenConns(100)

	// SetConnMaxLifetime 设置了连接可复用的最大时间
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}
