package service

import (
	"context"

	"errors"

	accountv1 "app.shiningacg.club/gen/proto/api/account/v1"
	"app.shiningacg.club/gen/proto/api/account/v1/accountv1connect"
	commonv1 "app.shiningacg.club/gen/proto/api/common/v1"
	"connectrpc.com/connect"
)

// AuthServiceServer 是 AuthService 的伪实现
type AuthServiceServer struct {
	accountv1connect.UnimplementedAuthServiceHandler
}

// 确保 AuthServiceServer 实现了 AuthServiceHandler 接口
var _ accountv1connect.AuthServiceHandler = (*AuthServiceServer)(nil)

// Login 伪实现登录接口
func (s *AuthServiceServer) Login(ctx context.Context, req *connect.Request[accountv1.LoginRequest]) (*connect.Response[accountv1.LoginResponse], error) {
	return connect.NewResponse(&accountv1.LoginResponse{
		AccessToken:  "test-session-token-123",
		RefreshToken: "refresh-token",
		User: &commonv1.UserSummary{
			UserId:        "114514",
			Nickname:      "ciallo",
			Avatar:        "https://example.com/avatar.png",
			IsVerified:    true,
			VerifiedTitle: "测试认证",
		},
	}), nil
}

// Logout 伪实现退出登录接口
func (s *AuthServiceServer) Logout(ctx context.Context, req *connect.Request[accountv1.LogoutRequest]) (*connect.Response[accountv1.LogoutResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("Logout 接口尚未实现"))
}

// RefreshToken 伪实现刷新 Token 接口
func (s *AuthServiceServer) RefreshToken(ctx context.Context, req *connect.Request[accountv1.RefreshTokenRequest]) (*connect.Response[accountv1.RefreshTokenResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("RefreshToken 接口尚未实现"))
}
