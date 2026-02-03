package interceptor

import (
	"encoding/json"
	"log"
	"net/http"
)

// ErrorInterceptor 错误处理拦截器
func ErrorInterceptor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				// 记录错误日志
				log.Printf("Panic recovered: %v", err)

				// 返回 500 内部服务器错误响应
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)

				// 响应内容
				json.NewEncoder(w).Encode(map[string]string{
					"error": "internal server error",
				})
			}
		}()

		// 继续处理请求
		next.ServeHTTP(w, r)
	})
}
