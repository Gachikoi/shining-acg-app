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
		Logger:                                   logger.NewGormLogger(logLevel),
		SkipDefaultTransaction:                   true, // 不要进行关联创建等操作
		DisableForeignKeyConstraintWhenMigrating: true, // 禁用物理外键
		PrepareStmt:                              true, // 启用预编译语句以提高性能
	})
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

// AutoMigrate 创建或更新所有业务表结构。
// 应在应用启动时调用一次（通常由 wire 注入后在 main 中执行）。
//
// 注意：此函数仅用于本地开发 / CI 初始化，生产环境禁止直接调用。
// 生产环境须通过版本化迁移工具（如 goose / atlas）执行 DDL，
// 以保证变更可追溯、可回滚，且不会对存量表加全表锁。
//
// 所有索引已通过 model 结构体的 gorm tag 声明（index:name,priority:N），
// AutoMigrate 会读取这些 tag 自动建立对应索引，无需在此额外执行裸 SQL。
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.MediaAsset{}, &model.MediaFile{},
		&model.Department{}, &model.Partition{},
		&model.User{},
		&model.VerificationApplication{}, &model.UserSettings{}, &model.Device{},
		&model.Post{}, &model.Comment{},
		&model.Follow{}, &model.Interaction{}, &model.Notification{},
		&model.ReportTicket{}, &model.ReportRecord{},
	)
}
