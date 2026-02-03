package interceptor

import (
	"log"
	"net/http"
	"time"
)

// LoggerInterceptor 日志拦截器
func LoggerInterceptor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// 创建响应包装器以捕获状态码
		lrw := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// 继续处理请求
		next.ServeHTTP(lrw, r)

		// 记录请求信息
		log.Printf(
			"%s %s %d %s %s",
			r.Method,
			r.URL.Path,
			lrw.statusCode,
			time.Since(start),
			r.RemoteAddr,
		)
	})
}

// loggingResponseWriter 是 http.ResponseWriter 的包装器，用于捕获状态码
type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (lrw *loggingResponseWriter) WriteHeader(code int) {
	lrw.statusCode = code
	lrw.ResponseWriter.WriteHeader(code)
}
