package service

import (
	"context"

	"errors"

	"app.shiningacg.club/gen/proto/api/v1/common"
	"app.shiningacg.club/gen/proto/api/v1/user"
	"app.shiningacg.club/gen/proto/api/v1/user/userconnect"
	"connectrpc.com/connect"
)

// AuthServiceServer 是 AuthService 的伪实现
type AuthServiceServer struct{}

// 确保 AuthServiceServer 实现了 AuthServiceHandler 接口
var _ userconnect.AuthServiceHandler = (*AuthServiceServer)(nil)

// Login 伪实现登录接口
func (s *AuthServiceServer) Login(ctx context.Context, req *connect.Request[user.LoginRequest]) (*connect.Response[user.LoginResponse], error) {
	return connect.NewResponse(&user.LoginResponse{
		SessionToken: "test-session-token-123",
		Me: &common.UserSummary{
			UserId:        "user-123",
			Nickname:      "测试用户",
			Avatar:        "https://example.com/avatar.png",
			IsVerified:    true,
			VerifiedTitle: "测试认证",
		},
	}), nil
}

// Logout 伪实现退出登录接口
func (s *AuthServiceServer) Logout(ctx context.Context, req *connect.Request[user.LogoutRequest]) (*connect.Response[user.LogoutResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("Logout 接口尚未实现"))
}

// RefreshToken 伪实现刷新 Token 接口
func (s *AuthServiceServer) RefreshToken(ctx context.Context, req *connect.Request[user.RefreshTokenRequest]) (*connect.Response[user.RefreshTokenResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("RefreshToken 接口尚未实现"))
}
