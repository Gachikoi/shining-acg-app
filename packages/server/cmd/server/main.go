package main

import (
	"context"
	"fmt"
	"net/http"

	"connectrpc.com/connect"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	// 这里的路径需要对应你 buf.gen.yaml 中的 go_package_prefix + 相对路径
	authv1 "app.shiningacg.club/gen/proto/api/v1"
	"app.shiningacg.club/gen/proto/api/v1/apiv1connect"
)

// AuthServiceServer 实现生成的接口
type AuthServiceServer struct{}

func (s *AuthServiceServer) Ping(
	ctx context.Context,
	req *connect.Request[authv1.PingRequest],
) (*connect.Response[authv1.PingResponse], error) {
	fmt.Printf("收到请求: %s\n", req.Msg.Number)
	res := connect.NewResponse(&authv1.PingResponse{
		Result: "Pong: " + req.Msg.Number,
	})
	return res, nil
}

func main() {
	mux := http.NewServeMux()
	// 注册服务
	path, handler := apiv1connect.NewAuthServiceHandler(&AuthServiceServer{})
	mux.Handle(path, handler)

	fmt.Println("Server 启动在 :8080...")
	// 使用 h2c 以支持没有 TLS 的 HTTP/2
	http.ListenAndServe(":8080", h2c.NewHandler(mux, &http2.Server{}))
}
