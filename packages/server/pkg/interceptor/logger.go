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

		// 使用支持更多接口（如 Flusher）的包装器
		lrw := &loggingResponseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(lrw, r)

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
