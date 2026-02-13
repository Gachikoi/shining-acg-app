package logger

import (
	"context"
	"log/slog"
	"os"
	"strings"
)

// TraceIDKey 是上下文传递 Trace ID 时使用的键
type TraceIDKey struct{}

// Handler 是自定义的 slog.Handler，用于从上下文中提取 Trace ID 并添加到日志中
type Handler struct {
	slog.Handler
}

// NewHandler 创建一个新的 Handler 实例
func NewHandler(h slog.Handler) *Handler {
	return &Handler{h}
}

// Handle 方法实现了 slog.Handler 接口，负责从上下文提取 Trace ID 并添加到日志中
func (h *Handler) Handle(ctx context.Context, r slog.Record) error {
	// 尝试从上下文中获取 Trace ID
	if traceID, ok := ctx.Value(TraceIDKey{}).(string); ok {
		r.AddAttrs(slog.Attr{Key: "trace_id", Value: slog.StringValue(traceID)})
	}
	// 调用底层 Handler 处理日志
	return h.Handler.Handle(ctx, r)
}

// WithAttrs 方法实现了 slog.Handler 接口，返回一个带有指定属性的新 Handler
func (h *Handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &Handler{h.Handler.WithAttrs(attrs)}
}

// WithGroup 方法实现了 slog.Handler 接口，返回一个带有指定分组的新 Handler
func (h *Handler) WithGroup(name string) slog.Handler {
	return &Handler{h.Handler.WithGroup(name)}
}

// Init 初始化日志系统
func Init(level string) {
	// 解析日志级别
	var l slog.Level
	switch strings.ToLower(level) {
	case "debug":
		l = slog.LevelDebug
	case "info":
		l = slog.LevelInfo
	case "warn":
		l = slog.LevelWarn
	case "error":
		l = slog.LevelError
	default:
		l = slog.LevelInfo
	}

	// 创建 JSON 格式化的 handler
	jsonHandler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:     l,
		AddSource: true, // 启用源信息（文件名和行号）
	})

	// 使用自定义 Handler 包装 JSON Handler
	handler := NewHandler(jsonHandler)

	// 设置为默认 logger
	slog.SetDefault(slog.New(handler))
}

// FromContext 从上下文中提取 Trace ID
func FromContext(ctx context.Context) string {
	if traceID, ok := ctx.Value(TraceIDKey{}).(string); ok {
		return traceID
	}
	return ""
}

// WithTraceID 向上下文中添加 Trace ID
func WithTraceID(ctx context.Context, traceID string) context.Context {
	return context.WithValue(ctx, TraceIDKey{}, traceID)
}
