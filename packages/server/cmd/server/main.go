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
	userv1 "app.shiningacg.club/gen/proto/api/v1"
	"app.shiningacg.club/gen/proto/api/v1/apiv1connect"
)

// AuthServiceServer 实现生成的接口
type AuthServiceServer struct{}

func (s *AuthServiceServer) Login(
	ctx context.Context,
	req *connect.Request[authv1.LoginRequest],
) (*connect.Response[authv1.LoginResponse], error) {
	fmt.Printf("Login 请求: QQAccessToken=%s, DeviceInfo=%s\n", req.Msg.QqAccessToken, req.Msg.DeviceInfo)
	res := connect.NewResponse(&authv1.LoginResponse{
		SessionToken: "test-session-token-123",
		Me: &authv1.UserSummary{
			UserId:        "user-123",
			Nickname:      "测试用户",
			Avatar:        "https://example.com/avatar.png",
			IsVerified:    true,
			VerifiedTitle: "测试认证",
		},
	})
	return res, nil
}

func (s *AuthServiceServer) Logout(
	ctx context.Context,
	req *connect.Request[authv1.LogoutRequest],
) (*connect.Response[authv1.LogoutResponse], error) {
	fmt.Println("Logout 请求")
	res := connect.NewResponse(&authv1.LogoutResponse{})
	return res, nil
}

func (s *AuthServiceServer) RefreshToken(
	ctx context.Context,
	req *connect.Request[authv1.RefreshTokenRequest],
) (*connect.Response[authv1.RefreshTokenResponse], error) {
	fmt.Printf("RefreshToken 请求: RefreshToken=%s\n", req.Msg.RefreshToken)
	res := connect.NewResponse(&authv1.RefreshTokenResponse{
		SessionToken: "new-session-token-456",
	})
	return res, nil
}

// UserServiceServer 实现生成的用户服务接口
type UserServiceServer struct{}

func (s *UserServiceServer) GetMe(
	ctx context.Context,
	req *connect.Request[userv1.GetMeRequest],
) (*connect.Response[userv1.GetMeResponse], error) {
	fmt.Printf("GetMe 请求: UserID=%s\n", req.Msg.UserId)
	res := connect.NewResponse(&userv1.GetMeResponse{
		Profile: &userv1.UserProfile{
			Base: &userv1.UserSummary{
				UserId:        req.Msg.UserId,
				Nickname:      "测试用户",
				Avatar:        "https://example.com/avatar.png",
				IsVerified:    true,
				VerifiedTitle: "测试认证",
			},
			Intro:                  "这是一个测试用户的个人介绍",
			FollowerCount:          100,
			FollowingCount:         50,
			PostCount:              20,
			LikeAndCollectionCount: 500,
			IsFollowing:            false,
			IsFollowedBy:           false,
		},
		PrivacySettings: &userv1.PrivacySettings{
			MessagePermission:    userv1.PrivacyLevel_PRIVACY_LEVEL_PUBLIC,
			CollectionVisibility: userv1.PrivacyLevel_PRIVACY_LEVEL_FOLLOWERS,
			LikeVisibility:       userv1.PrivacyLevel_PRIVACY_LEVEL_PUBLIC,
		},
		UserSettings: &userv1.UserSettings{
			EnablePushNotifications: true,
		},
	})
	return res, nil
}

func (s *UserServiceServer) GetUser(
	ctx context.Context,
	req *connect.Request[userv1.GetUserRequest],
) (*connect.Response[userv1.GetUserResponse], error) {
	fmt.Printf("GetUser 请求: TargetUserID=%s\n", req.Msg.TargetUserId)
	res := connect.NewResponse(&userv1.GetUserResponse{
		Profile: &userv1.UserProfile{
			Base: &userv1.UserSummary{
				UserId:     req.Msg.TargetUserId,
				Nickname:   "目标用户",
				Avatar:     "https://example.com/target_avatar.png",
				IsVerified: false,
			},
			Intro:                  "这是目标用户的个人介绍",
			FollowerCount:          50,
			FollowingCount:         20,
			PostCount:              10,
			LikeAndCollectionCount: 200,
			IsFollowing:            true,
			IsFollowedBy:           false,
		},
		PrivacySettings: &userv1.PrivacySettings{
			MessagePermission:    userv1.PrivacyLevel_PRIVACY_LEVEL_PUBLIC,
			CollectionVisibility: userv1.PrivacyLevel_PRIVACY_LEVEL_PRIVATE,
			LikeVisibility:       userv1.PrivacyLevel_PRIVACY_LEVEL_PUBLIC,
		},
	})
	return res, nil
}

func (s *UserServiceServer) UpdateProfile(
	ctx context.Context,
	req *connect.Request[userv1.UpdateProfileRequest],
) (*connect.Response[userv1.UpdateProfileResponse], error) {
	fmt.Printf("UpdateProfile 请求: UserID=%s\n", req.Msg.Profile.Base.UserId)
	res := connect.NewResponse(&userv1.UpdateProfileResponse{
		UpdatedProfile: req.Msg.Profile,
	})
	return res, nil
}

func (s *UserServiceServer) Follow(
	ctx context.Context,
	req *connect.Request[userv1.FollowRequest],
) (*connect.Response[userv1.FollowResponse], error) {
	fmt.Printf("Follow 请求: TargetUserID=%s\n", req.Msg.TargetUserId)
	res := connect.NewResponse(&userv1.FollowResponse{
		Success: true,
	})
	return res, nil
}

func (s *UserServiceServer) Unfollow(
	ctx context.Context,
	req *connect.Request[userv1.UnfollowRequest],
) (*connect.Response[userv1.UnfollowResponse], error) {
	fmt.Printf("Unfollow 请求: TargetUserID=%s\n", req.Msg.TargetUserId)
	res := connect.NewResponse(&userv1.UnfollowResponse{
		Success: true,
	})
	return res, nil
}

func (s *UserServiceServer) ListFollowers(
	ctx context.Context,
	req *connect.Request[userv1.ListFollowersRequest],
) (*connect.Response[userv1.ListFollowersResponse], error) {
	fmt.Printf("ListFollowers 请求: UserID=%s\n", req.Msg.UserId)
	res := connect.NewResponse(&userv1.ListFollowersResponse{
		Users: []*userv1.UserSummary{
			{
				UserId:     "user1",
				Nickname:   "粉丝1",
				Avatar:     "https://example.com/fan1.png",
				IsVerified: false,
			},
			{
				UserId:        "user2",
				Nickname:      "粉丝2",
				Avatar:        "https://example.com/fan2.png",
				IsVerified:    true,
				VerifiedTitle: "认证粉丝",
			},
		},
		NextPageToken: "",
	})
	return res, nil
}

func (s *UserServiceServer) ListFollowing(
	ctx context.Context,
	req *connect.Request[userv1.ListFollowingRequest],
) (*connect.Response[userv1.ListFollowingResponse], error) {
	fmt.Printf("ListFollowing 请求: UserID=%s\n", req.Msg.UserId)
	res := connect.NewResponse(&userv1.ListFollowingResponse{
		Users: []*userv1.UserSummary{
			{
				UserId:        "user3",
				Nickname:      "关注用户1",
				Avatar:        "https://example.com/following1.png",
				IsVerified:    true,
				VerifiedTitle: "大V",
			},
		},
		NextPageToken: "",
	})
	return res, nil
}

func (s *UserServiceServer) SearchUsers(
	ctx context.Context,
	req *connect.Request[userv1.SearchUsersRequest],
) (*connect.Response[userv1.SearchUsersResponse], error) {
	fmt.Printf("SearchUsers 请求: Keyword=%s\n", req.Msg.Keyword)
	res := connect.NewResponse(&userv1.SearchUsersResponse{
		Results: []*userv1.UserSummary{
			{
				UserId:     "search1",
				Nickname:   "搜索结果1",
				Avatar:     "https://example.com/search1.png",
				IsVerified: false,
			},
			{
				UserId:        "search2",
				Nickname:      "搜索结果2",
				Avatar:        "https://example.com/search2.png",
				IsVerified:    true,
				VerifiedTitle: "搜索认证",
			},
		},
		NextPageToken: "",
	})
	return res, nil
}

func main() {
	mux := http.NewServeMux()
	// 注册服务
	path, handler := apiv1connect.NewAuthServiceHandler(&AuthServiceServer{})
	mux.Handle(path, handler)
	userPath, userHandler := apiv1connect.NewUserServiceHandler(&UserServiceServer{})
	mux.Handle(userPath, userHandler)

	fmt.Println("Server 启动在 :8080...")
	// 使用 h2c 以支持没有 TLS 的 HTTP/2
	http.ListenAndServe(":8080", h2c.NewHandler(mux, &http2.Server{}))
}
