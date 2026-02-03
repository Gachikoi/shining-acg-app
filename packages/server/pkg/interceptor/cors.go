package interceptor

import (
	"net/http"

	"golang.org/x/net/http2/h2c"
)

// CORSInterceptor 跨域请求拦截器
func CORSInterceptor(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 设置 CORS 头
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// 处理预检请求
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// 继续处理请求
		next.ServeHTTP(w, r)
	})
}

// H2CInterceptor 支持 h2c (HTTP/2 明文) 拦截器
func H2CInterceptor(next http.Handler) http.Handler {
	return h2c.NewHandler(next, nil)
}
