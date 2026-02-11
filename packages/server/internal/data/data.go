package data

import (
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"app.shiningacg.club/config"
)

// Data 数据层实例
type Data struct {
	db *gorm.DB
}

// NewData 创建数据层实例
//func NewData(cfg *config.Config) (*Data, func(), error) {
//	db, err := NewDB(cfg)
//	if err != nil {
//		return nil, nil, err
//	}
//
//	cleanup := func() {
//		sqlDB, err := db.DB()
//		if err != nil {
//			return
//		}
//		sqlDB.Close()
//	}
//
//	return &Data{db: db}, cleanup, nil
//}

// NewDB 创建数据库连接
func NewDB(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.GetDBConnectionString()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	// 自动迁移数据库
	err = db.AutoMigrate(&Media{})
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
