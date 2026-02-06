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
type UserServiceServer struct {
	accountv1connect.UnimplementedUserServiceHandler
}

// 确保 UserServiceServer 实现了 UserServiceHandler 接口
var _ accountv1connect.UserServiceHandler = (*UserServiceServer)(nil)

// GetMe 伪实现获取当前用户信息接口
func (s *UserServiceServer) GetMe(ctx context.Context, req *connect.Request[accountv1.GetMeRequest]) (*connect.Response[accountv1.GetMeResponse], error) {
	return connect.NewResponse(&accountv1.GetMeResponse{
		Profile: &accountv1.UserProfile{
			Base: &commonv1.UserSummary{
				UserId:   "114514",
				Nickname: "ciallo",
				Avatar:   "https://example.com/avatar.png",
				Departments: []*commonv1.DepartmentBase{
					{
						Id:   "light_music",
						Name: "轻音部",
					},
				},
				IsVerified:    true,
				VerifiedTitle: "测试认证",
			},
			Links: []*commonv1.Link{},
			Stats: &accountv1.UserStats{
				FollowerCount:        100,
				FollowingCount:       50,
				LikeCountReceived:    1000,
				CollectCountReceived: 500,
				ViewCountReceived:    10000,
			},
			RelationStatus: &accountv1.UserRelationStatus{},
			Role:           commonv1.Role_ROLE_USER,
		},
		Settings: &accountv1.UserSettings{
			Notification: &accountv1.NotificationSettings{
				PushEnabled:     true,
				PushChat:        true,
				PushCommentAt:   true,
				PushLikeCollect: true,
				PushNewFollower: true,
				PushPostUpdate:  true,
				PushSystem:      true,
			},
			Privacy: &accountv1.PrivacySettings{
				MessagePermission:        accountv1.MessagePrivacyLevel_MESSAGE_PRIVACY_LEVEL_PUBLIC,
				LikedPostsVisibility:     accountv1.BasePrivacyLevel_BASE_PRIVACY_LEVEL_PUBLIC,
				CollectedPostsVisibility: accountv1.BasePrivacyLevel_BASE_PRIVACY_LEVEL_PUBLIC,
			},
			Appearance: &accountv1.AppearanceSettings{
				Theme: accountv1.AppearanceSettings_THEME_SYSTEM,
			},
		},
	}), nil
}

// GetUsers 伪实现获取用户信息接口
func (s *UserServiceServer) GetUsers(ctx context.Context, req *connect.Request[accountv1.GetUsersRequest]) (*connect.Response[accountv1.GetUsersResponse], error) {
	var users []*accountv1.UserProfile
	for _, userId := range req.Msg.GetUserIds() {
		users = append(users, &accountv1.UserProfile{
			Base: &commonv1.UserSummary{
				UserId:     userId,
				Nickname:   "用户" + userId,
				Avatar:     "https://example.com/avatar.png",
				IsVerified: false,
			},
		})
	}
	return connect.NewResponse(&accountv1.GetUsersResponse{
		Users: users,
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

// ApplyVerification 伪实现申请认证接口
func (s *UserServiceServer) ApplyVerification(ctx context.Context, req *connect.Request[accountv1.ApplyVerificationRequest]) (*connect.Response[accountv1.ApplyVerificationResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ApplyVerification 接口尚未实现"))
}

// ModifyDepartments 伪实现修改部门接口
func (s *UserServiceServer) ModifyDepartments(ctx context.Context, req *connect.Request[accountv1.ModifyDepartmentsRequest]) (*connect.Response[accountv1.ModifyDepartmentsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ModifyDepartments 接口尚未实现"))
}
