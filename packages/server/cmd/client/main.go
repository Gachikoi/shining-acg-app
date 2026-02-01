package main

import (
	"context"
	"fmt"

	authv1 "app.shiningacg.club/gen/proto/api/v1"
	userv1 "app.shiningacg.club/gen/proto/api/v1"
	"app.shiningacg.club/gen/proto/api/v1/apiv1connect"
	"connectrpc.com/connect"
	"net/http"
)

func main() {
	// 创建客户端
	client := apiv1connect.NewAuthServiceClient(
		http.DefaultClient,
		"http://localhost:8080",
	)

	// 测试 Login
	fmt.Println("=== 测试 Login ===")
	loginResp, err := client.Login(context.Background(), connect.NewRequest(&authv1.LoginRequest{
		QqAccessToken: "test-qq-token-123",
		DeviceInfo:    "test-device-info",
	}))
	if err != nil {
		fmt.Printf("Login 失败: %v\n", err)
		return
	}
	fmt.Printf("Login 成功: SessionToken=%s\n", loginResp.Msg.SessionToken)
	fmt.Printf("UserInfo: %v\n", loginResp.Msg.Me)
	fmt.Println()

	// 测试 GetMe
	fmt.Println("=== 测试 GetMe ===")
	userClient := apiv1connect.NewUserServiceClient(
		http.DefaultClient,
		"http://localhost:8080",
	)
	getMeResp, err := userClient.GetMe(context.Background(), connect.NewRequest(&userv1.GetMeRequest{
		UserId: loginResp.Msg.Me.UserId,
	}))
	if err != nil {
		fmt.Printf("GetMe 失败: %v\n", err)
		return
	}
	fmt.Printf("GetMe 成功: UserId=%s, Nickname=%s\n",
		getMeResp.Msg.Profile.Base.UserId,
		getMeResp.Msg.Profile.Base.Nickname)
	fmt.Printf("FollowerCount: %d\n", getMeResp.Msg.Profile.FollowerCount)
	fmt.Printf("MessagePermission: %v\n", getMeResp.Msg.PrivacySettings.MessagePermission)
	fmt.Println()

	// 测试 SearchUsers
	fmt.Println("=== 测试 SearchUsers ===")
	searchResp, err := userClient.SearchUsers(context.Background(), connect.NewRequest(&userv1.SearchUsersRequest{
		Keyword: "测试",
	}))
	if err != nil {
		fmt.Printf("SearchUsers 失败: %v\n", err)
		return
	}
	fmt.Printf("SearchUsers 成功: 找到 %d 个用户\n", len(searchResp.Msg.Results))
	for i, user := range searchResp.Msg.Results {
		fmt.Printf("  %d. %s (%s)\n", i+1, user.Nickname, user.UserId)
	}
	fmt.Println()

	// 测试 RefreshToken
	fmt.Println("=== 测试 RefreshToken ===")
	refreshResp, err := client.RefreshToken(context.Background(), connect.NewRequest(&authv1.RefreshTokenRequest{
		RefreshToken: "test-refresh-token",
	}))
	if err != nil {
		fmt.Printf("RefreshToken 失败: %v\n", err)
		return
	}
	fmt.Printf("RefreshToken 成功: NewSessionToken=%s\n", refreshResp.Msg.SessionToken)
}
