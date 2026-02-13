package interceptor

import (
	"log/slog"
	"net/http"
	"time"

	"app.shiningacg.club/pkg/logger"
	"github.com/google/uuid"
)

// TracingInterceptor 全链路追踪拦截器，替代原来的 LoggerInterceptor
func TracingInterceptor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// 从请求头中获取或生成 Trace ID
		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}

		// 创建带 Trace ID 的上下文
		ctx := logger.WithTraceID(r.Context(), traceID)

		// 设置响应头回写 Trace ID
		w.Header().Set("X-Trace-ID", traceID)

		// 使用支持更多接口（如 Flusher）的包装器
		lrw := &loggingResponseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		// 处理请求
		next.ServeHTTP(lrw, r.WithContext(ctx))

		// 记录访问日志，使用 slog 并携带上下文
		slog.InfoContext(ctx, "HTTP request completed",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", lrw.statusCode),
			slog.Duration("latency", time.Since(start)),
			slog.String("remote_addr", r.RemoteAddr),
		)
	})
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (lrw *loggingResponseWriter) WriteHeader(code int) {
	lrw.statusCode = code
	lrw.ResponseWriter.WriteHeader(code)
}

// Flush
// 当 Vanguard 调用 Flush 时，它会通过这个方法调用到底层真正的 ResponseWriter
func (lrw *loggingResponseWriter) Flush() {
	if f, ok := lrw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
