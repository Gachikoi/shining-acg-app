package service

import (
	"context"
	"errors"

	accountv1 "app.shiningacg.club/gen/proto/api/account/v1"
	"app.shiningacg.club/gen/proto/api/account/v1/accountv1connect"
	commonv1 "app.shiningacg.club/gen/proto/api/common/v1"
	"connectrpc.com/connect"
)

// UserServiceServer 是 UserService 的伪实现
type UserServiceServer struct{}

// 确保 UserServiceServer 实现了 UserServiceHandler 接口
var _ accountv1connect.UserServiceHandler = (*UserServiceServer)(nil)

// GetMe 伪实现获取当前用户信息接口
func (s *UserServiceServer) GetMe(ctx context.Context, req *connect.Request[accountv1.GetMeRequest]) (*connect.Response[accountv1.GetMeResponse], error) {
	return connect.NewResponse(&accountv1.GetMeResponse{
		Profile: &accountv1.UserProfile{
			Base: &commonv1.UserSummary{
				UserId:            "114514",
				Nickname:          "ciallo",
				Avatar:            "https://example.com/avatar.png",
				PrimaryDepartment: commonv1.Department_DEPARTMENT_LIGHT_MUSIC,
				IsVerified:        true,
				VerifiedTitle:     "测试认证",
			},
			Intro:           "这是我的个人简介",
			BackgroundImage: "https://example.com/background.jpg",
			Departments:     []commonv1.Department{commonv1.Department_DEPARTMENT_LIGHT_MUSIC},
			Links:           []*commonv1.Link{},
			Stats: &accountv1.UserStats{
				FollowerCount:     100,
				FollowingCount:    50,
				PostCount:         20,
				LikeCountReceived: 1000,
				ViewCountReceived: 10000,
			},
			RelationStatus: &accountv1.UserRelationStatus{},
			IpLocation:     "北京",
			Role:           commonv1.Role_ROLE_USER,
		},
		PrivacySettings: &accountv1.PrivacySettings{
			MessagePermission: accountv1.PrivacyLevel_PRIVACY_LEVEL_PUBLIC,
			ListVisibility:    accountv1.PrivacyLevel_PRIVACY_LEVEL_PUBLIC,
			ShowOnlineStatus:  true,
		},
		UserSettings: &accountv1.UserSettings{
			EnablePush:              true,
			EnableEmailNotification: false,
			Language:                "zh-CN",
			Theme:                   "dark",
		},
	}), nil
}

// GetUser 伪实现获取用户信息接口
func (s *UserServiceServer) GetUser(ctx context.Context, req *connect.Request[accountv1.GetUserRequest]) (*connect.Response[accountv1.GetUserResponse], error) {
	return connect.NewResponse(&accountv1.GetUserResponse{
		Profile: &accountv1.UserProfile{
			Base: &commonv1.UserSummary{
				UserId:            req.Msg.TargetUserId,
				Nickname:          "测试用户",
				Avatar:            "https://example.com/avatar.png",
				PrimaryDepartment: commonv1.Department_DEPARTMENT_LIGHT_MUSIC,
				IsVerified:        false,
			},
			Intro:           "这是测试用户的个人简介",
			BackgroundImage: "https://example.com/background.jpg",
			Departments:     []commonv1.Department{commonv1.Department_DEPARTMENT_LIGHT_MUSIC},
			Links:           []*commonv1.Link{},
			Stats: &accountv1.UserStats{
				FollowerCount:     10,
				FollowingCount:    5,
				PostCount:         2,
				LikeCountReceived: 100,
				ViewCountReceived: 1000,
			},
			RelationStatus: &accountv1.UserRelationStatus{},
			IpLocation:     "上海",
			Role:           commonv1.Role_ROLE_USER,
		},
	}), nil
}

// BatchGetUsers 伪实现批量获取用户信息接口
func (s *UserServiceServer) BatchGetUsers(ctx context.Context, req *connect.Request[accountv1.BatchGetUsersRequest]) (*connect.Response[accountv1.BatchGetUsersResponse], error) {
	var profiles []*accountv1.UserProfile
	for _, userId := range req.Msg.UserIds {
		profiles = append(profiles, &accountv1.UserProfile{
			Base: &commonv1.UserSummary{
				UserId:            userId,
				Nickname:          "用户" + userId,
				Avatar:            "https://example.com/avatar.png",
				PrimaryDepartment: commonv1.Department_DEPARTMENT_LIGHT_MUSIC,
				IsVerified:        false,
			},
		})
	}

	return connect.NewResponse(&accountv1.BatchGetUsersResponse{
		Profiles: profiles,
	}), nil
}

// UpdateProfile 伪实现更新个人资料接口
func (s *UserServiceServer) UpdateProfile(ctx context.Context, req *connect.Request[accountv1.UpdateProfileRequest]) (*connect.Response[accountv1.UpdateProfileResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpdateProfile 接口尚未实现"))
}

// UpdateSettings 伪实现更新设置接口
func (s *UserServiceServer) UpdateSettings(ctx context.Context, req *connect.Request[accountv1.UpdateSettingsRequest]) (*connect.Response[accountv1.UpdateSettingsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpdateSettings 接口尚未实现"))
}

// SetFollow 伪实现关注接口
func (s *UserServiceServer) SetFollow(ctx context.Context, req *connect.Request[accountv1.SetFollowRequest]) (*connect.Response[accountv1.SetFollowResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("SetFollow 接口尚未实现"))
}

// ListRelationships 伪实现获取关系列表接口
func (s *UserServiceServer) ListRelationships(ctx context.Context, req *connect.Request[accountv1.ListRelationshipsRequest]) (*connect.Response[accountv1.ListRelationshipsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ListRelationships 接口尚未实现"))
}

// ListMutualFollowers 伪实现获取共同关注接口
func (s *UserServiceServer) ListMutualFollowers(ctx context.Context, req *connect.Request[accountv1.ListMutualFollowersRequest]) (*connect.Response[accountv1.ListMutualFollowersResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ListMutualFollowers 接口尚未实现"))
}

// SearchUsers 伪实现搜索用户接口
func (s *UserServiceServer) SearchUsers(ctx context.Context, req *connect.Request[accountv1.SearchUsersRequest]) (*connect.Response[accountv1.SearchUsersResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("SearchUsers 接口尚未实现"))
}
