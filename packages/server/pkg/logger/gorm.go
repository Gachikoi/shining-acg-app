package logger

import (
	"context"
	"log/slog"
	"time"

	gormlogger "gorm.io/gorm/logger"
)

// GormLogger 是 GORM 的日志接口实现，用于将 GORM 的日志输出到我们的 slog 系统
type GormLogger struct {
	level gormlogger.LogLevel
}

// NewGormLogger 创建一个新的 GORM 日志实例
func NewGormLogger(level gormlogger.LogLevel) *GormLogger {
	return &GormLogger{
		level: level,
	}
}

// LogMode 实现 gormlogger.Interface 接口
func (l *GormLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	newLogger := *l
	newLogger.level = level
	return &newLogger
}

// Info 实现 gormlogger.Interface 接口
func (l *GormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= gormlogger.Info {
		slog.InfoContext(ctx, msg, data...)
	}
}

// Warn 实现 gormlogger.Interface 接口
func (l *GormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= gormlogger.Warn {
		slog.WarnContext(ctx, msg, data...)
	}
}

// Error 实现 gormlogger.Interface 接口
func (l *GormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	if l.level >= gormlogger.Error {
		slog.ErrorContext(ctx, msg, data...)
	}
}

// Trace 实现 gormlogger.Interface 接口，用于记录 SQL 查询的执行时间
func (l *GormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	if l.level <= gormlogger.Silent {
		return
	}

	elapsed := time.Since(begin)
	sql, rows := fc()

	switch {
	case err != nil && l.level >= gormlogger.Error:
		slog.ErrorContext(ctx, "SQL query failed",
			slog.String("sql", sql),
			slog.Int64("rows", rows),
			slog.Duration("elapsed", elapsed),
			slog.Any("error", err),
		)
	case elapsed > 100*time.Millisecond && l.level >= gormlogger.Warn:
		// 慢查询警告
		slog.WarnContext(ctx, "Slow SQL query",
			slog.String("sql", sql),
			slog.Int64("rows", rows),
			slog.Duration("elapsed", elapsed),
		)
	case l.level >= gormlogger.Info:
		slog.InfoContext(ctx, "SQL query executed",
			slog.String("sql", sql),
			slog.Int64("rows", rows),
			slog.Duration("elapsed", elapsed),
		)
	}
}

// 提供便捷的函数，直接创建常见级别的 GORM 日志实例
func NewGormInfoLogger() *GormLogger {
	return NewGormLogger(gormlogger.Info)
}

func NewGormWarnLogger() *GormLogger {
	return NewGormLogger(gormlogger.Warn)
}

func NewGormErrorLogger() *GormLogger {
	return NewGormLogger(gormlogger.Error)
}
