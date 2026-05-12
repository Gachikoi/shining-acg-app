package user

import (
	"context"
	"errors"
	"strconv"

	userv1 "app.shiningacg.club/gen/proto/api/main/user/v1"
	"app.shiningacg.club/gen/proto/api/main/user/v1/userv1connect"
	"connectrpc.com/connect"
	"gorm.io/gorm"
)

// UserServiceServer 是 UserService 的伪实现
type UserServiceServer struct {
	userv1connect.UnimplementedUserServiceHandler
	useCase UserUseCase
	repo    UserRepo
}

// 确保 UserServiceServer 实现了 UserServiceHandler 接口
var _ userv1connect.UserServiceHandler = (*UserServiceServer)(nil)

// GetMe 获取当前登录用户的个人资料和设置
func (s *UserServiceServer) GetMe(ctx context.Context, req *connect.Request[userv1.GetMeRequest]) (*connect.Response[userv1.GetMeResponse], error) {

	// 调用业务逻辑层获取用户资料和设置
	user, settings, err := s.useCase.GetMe(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 返回用户资料和设置
	return connect.NewResponse(&userv1.GetMeResponse{
		Profile:  user,
		Settings: settings,
	}), nil

}

// GetUser 根据用户ID获取指定用户的资料、关系状态和查看权限
func (s *UserServiceServer) GetUser(ctx context.Context, req *connect.Request[userv1.GetUserRequest]) (*connect.Response[userv1.GetUserResponse], error) {

	// 调用业务逻辑层获取用户信息
	profile, relation, capability, err := s.useCase.GetUser(ctx, req.Msg.UserId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 返回用户资料、关系状态和查看权限
	return connect.NewResponse(&userv1.GetUserResponse{
		User:             profile,
		RelationStatus:   relation,
		ViewCapabilities: capability,
	}), nil
}

// ListUserFollowings 分页获取当前用户关注的用户列表
func (s *UserServiceServer) ListUserFollowings(ctx context.Context, req *connect.Request[userv1.ListUserRelatedRequest]) (*connect.Response[userv1.ListUserRelatedResponse], error) {
	// 调用业务逻辑层获取关注用户列表
	items, cursor, err := s.useCase.ListUserFollowings(ctx, req.Msg.Pagination, req.Msg.Filter)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 返回关注用户列表和分页游标
	return connect.NewResponse(&userv1.ListUserRelatedResponse{
		Users:  items,
		Cursor: cursor,
	}), nil
}

// ListUserFollowers 分页获取当前用户的粉丝列表
func (s *UserServiceServer) ListUserFollowers(ctx context.Context, req *connect.Request[userv1.ListUserRelatedRequest]) (*connect.Response[userv1.ListUserRelatedResponse], error) {
	// 调用业务逻辑层获取粉丝列表
	items, cursor, err := s.useCase.ListUserFollowers(ctx, req.Msg.Pagination, req.Msg.Filter)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 返回粉丝列表和分页游标
	return connect.NewResponse(&userv1.ListUserRelatedResponse{
		Users:  items,
		Cursor: cursor,
	}), nil
}

// ListUserMutualFollowers 分页获取当前用户的互关列表
func (s *UserServiceServer) ListUserMutualFollowers(ctx context.Context, req *connect.Request[userv1.ListUserRelatedRequest]) (*connect.Response[userv1.ListUserRelatedResponse], error) {
	// 调用业务逻辑层获取互关列表
	items, cursor, err := s.useCase.ListMutualFollowings(ctx, req.Msg.Pagination, req.Msg.Filter)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 返回互关列表和分页游标
	return connect.NewResponse(&userv1.ListUserRelatedResponse{
		Users:  items,
		Cursor: cursor,
	}), nil
}

// GetUserIdByQQ 根据QQ号码获取对应的用户ID
func (s *UserServiceServer) GetUserIdByQQ(ctx context.Context, req *connect.Request[userv1.GetUserIdByQQRequest]) (*connect.Response[userv1.GetUserIdByQQResponse], error) {

	// 通过仓库层根据QQ号查询用户ID
	id, err := s.repo.GetUserIDByQQNum(ctx, req.Msg.QqNumber)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 用户不存在，返回404错误
		return nil, connect.NewError(connect.CodeNotFound, err)
	}

	if err != nil {
		// 其他错误，返回内部错误
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 将用户ID转换为字符串并返回
	return connect.NewResponse(&userv1.GetUserIdByQQResponse{
		UserId: strconv.FormatInt(id, 10),
	}), nil
}

// SetFollow 设置当前用户是否关注目标用户
func (s *UserServiceServer) SetFollow(ctx context.Context, req *connect.Request[userv1.SetFollowRequest]) (*connect.Response[userv1.SetFollowResponse], error) {
	// 调用业务逻辑层设置关注状态
	err := s.useCase.SetFollow(ctx, req.Msg.UserId, req.Msg.IsFollowing)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&userv1.SetFollowResponse{}), nil
}

// EditLinks 编辑当前用户的个性链接
func (s *UserServiceServer) EditLinks(ctx context.Context, req *connect.Request[userv1.EditLinksRequest]) (*connect.Response[userv1.EditLinksResponse], error) {
	// 调用业务逻辑层编辑用户链接
	err := s.useCase.EditLinks(ctx, req.Msg.Links)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&userv1.EditLinksResponse{}), nil
}

// ChangeName 修改当前用户的昵称
func (u *UserServiceServer) ChangeName(ctx context.Context, req *connect.Request[userv1.ChangeNameRequest]) (*connect.Response[userv1.ChangeNameResponse], error) {

	// 调用业务逻辑层修改用户昵称
	err := u.useCase.ChangeName(ctx, req.Msg.Name)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&userv1.ChangeNameResponse{}), nil
}

// ChangeAvatar 修改当前用户的头像
func (u *UserServiceServer) ChangeAvatar(ctx context.Context, req *connect.Request[userv1.ChangeAvatarRequest]) (*connect.Response[userv1.ChangeAvatarResponse], error) {
	// 调用业务逻辑层修改用户头像
	err := u.useCase.ChangeAvatar(ctx, req.Msg.AvatarUrl)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&userv1.ChangeAvatarResponse{}), nil
}

// UpdateSettings 更新当前用户的设置（通知、隐私、内容分类等）
func (u *UserServiceServer) UpdateSettings(ctx context.Context, req *connect.Request[userv1.UpdateSettingsRequest]) (*connect.Response[userv1.UpdateSettingsResponse], error) {
	// 调用业务逻辑层更新用户设置
	err := u.useCase.UpdateSettings(ctx, req.Msg.Settings)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&userv1.UpdateSettingsResponse{}), nil
}

// ListUserPosts 分页获取指定用户发布的帖子列表
func (u *UserServiceServer) ListUserPosts(ctx context.Context, req *connect.Request[userv1.ListUserPostsRequest]) (*connect.Response[userv1.ListUserPostsResponse], error) {
	// 调用业务逻辑层获取用户发布的帖子列表
	items, cursor, err := u.useCase.ListUserPosts(ctx, req.Msg.UserId, req.Msg.Pagination, req.Msg.Filter)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 返回帖子列表和分页游标
	return connect.NewResponse(&userv1.ListUserPostsResponse{
		Posts:  items,
		Cursor: cursor,
	}), nil

}

// ListUserLikedPosts 分页获取指定用户点赞的帖子列表
func (u *UserServiceServer) ListUserLikedPosts(ctx context.Context, req *connect.Request[userv1.ListUserPostsRequest]) (*connect.Response[userv1.ListUserPostsResponse], error) {
	// 调用业务逻辑层获取用户点赞的帖子列表
	items, cursor, err := u.useCase.ListUserLikedPosts(ctx, req.Msg.UserId, req.Msg.Pagination, req.Msg.Filter)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 返回帖子列表和分页游标
	return connect.NewResponse(&userv1.ListUserPostsResponse{
		Posts:  items,
		Cursor: cursor,
	}), nil

}

// ListUserCollectedPosts 分页获取指定用户收藏的帖子列表
func (u *UserServiceServer) ListUserCollectedPosts(ctx context.Context, req *connect.Request[userv1.ListUserPostsRequest]) (*connect.Response[userv1.ListUserPostsResponse], error) {
	// 调用业务逻辑层获取用户收藏的帖子列表
	items, cursor, err := u.useCase.ListUserCollectedPosts(ctx, req.Msg.UserId, req.Msg.Pagination, req.Msg.Filter)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 返回帖子列表和分页游标
	return connect.NewResponse(&userv1.ListUserPostsResponse{
		Posts:  items,
		Cursor: cursor,
	}), nil

}
