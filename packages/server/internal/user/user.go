package user

import (
	"context"
	"fmt"
	"strconv"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
	postv1 "app.shiningacg.club/gen/proto/api/main/post/v1"
	userv1 "app.shiningacg.club/gen/proto/api/main/user/v1"
	"app.shiningacg.club/internal/department"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/internal/post"
)

// UserUseCase 定义了用户相关业务逻辑的接口
// 包括获取用户信息、管理关注关系、编辑用户资料和获取用户内容等功能
type UserUseCase interface {
	// GetMe 获取当前登录用户的个人资料和设置
	GetMe(ctx context.Context) (*commonv1.UserProfile, *userv1.SyncedUserSettings, error)

	// GetUser 根据用户ID获取指定用户的资料、关系状态和查看权限
	GetUser(ctx context.Context, TargetID string) (*commonv1.UserProfile, *commonv1.UserRelationStatus, *commonv1.UserViewCapabilities, error)

	// ListUserFollowings 分页获取当前用户关注的用户列表
	ListUserFollowings(ctx context.Context, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*userv1.UserListItem, *string, error)

	// ListUserFollowers 分页获取当前用户的粉丝列表
	ListUserFollowers(ctx context.Context, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*userv1.UserListItem, *string, error)

	// ListMutualFollowings 分页获取当前用户的互关列表
	ListMutualFollowings(ctx context.Context, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*userv1.UserListItem, *string, error)

	// ListUserPosts 分页获取指定用户发布的帖子列表
	ListUserPosts(ctx context.Context, UserID string, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*postv1.PostPreview, *string, error)

	// ListUserLikedPosts 分页获取指定用户点赞的帖子列表
	ListUserLikedPosts(ctx context.Context, UserID string, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*postv1.PostPreview, *string, error)

	// ListUserCollectedPosts 分页获取指定用户收藏的帖子列表
	ListUserCollectedPosts(ctx context.Context, UserID string, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*postv1.PostPreview, *string, error)

	// SetFollow 设置当前用户是否关注目标用户
	SetFollow(ctx context.Context, TargetID string, isFollowing bool) error

	// EditLinks 编辑当前用户的个性链接
	EditLinks(ctx context.Context, links []*commonv1.Link) error

	// ChangeName 修改当前用户的昵称
	ChangeName(ctx context.Context, newName string) error

	// ChangeAvatar 修改当前用户的头像
	ChangeAvatar(ctx context.Context, avatarUrl string) error

	// UpdateSettings 更新当前用户的设置（通知、隐私、内容分类等）
	UpdateSettings(ctx context.Context, settings *userv1.SyncedUserSettings) error
}

// UserUseCaseImpl 是 UserUseCase 接口的实现
// 包含用户仓库、帖子仓库和部门仓库的依赖注入
type UserUseCaseImpl struct {
	UserRepo       UserRepo                  // 用户数据访问层
	PostRepo       post.PostRepo             // 帖子数据访问层
	DepartmentRepo department.DepartmentRepo // 部门数据访问层
}

// NewUserUseCase 创建并返回 UserUseCaseImpl 的新实例
func NewUserUseCase(userRepo UserRepo, postRepo post.PostRepo, departmentRepo department.DepartmentRepo) *UserUseCaseImpl {
	return &UserUseCaseImpl{
		UserRepo:       userRepo,
		PostRepo:       postRepo,
		DepartmentRepo: departmentRepo,
	}
}

// GetMe 获取当前登录用户的个人资料和同步设置
func (u *UserUseCaseImpl) GetMe(ctx context.Context) (*commonv1.UserProfile, *userv1.SyncedUserSettings, error) {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 从数据库获取用户信息
	user, err := u.UserRepo.GetMe(ctx, id)
	if err != nil {
		return nil, nil, err
	}

	// 获取用户所属部门信息（通过部门仓库按 ID 列表查询）
	dprt, err := u.DepartmentRepo.GetDepartment(ctx, user.Departments)
	if err != nil {
		return nil, nil, err
	}

	// 将部门模型转换为 API 可返回的 DepartmentBase 列表
	departmentBases := make([]*commonv1.DepartmentBase, len(dprt))
	for _, v := range dprt {
		departmentBases = append(departmentBases, v.ToDepartmentBase())
	}

	// 返回用户资料、设置和空错误
	return user.ToProfile(nil, departmentBases), user.Settings.ToSyncedUserSettings(), nil
}

// GetUser 获取指定用户的详细信息、关系状态和操作权限
func (u *UserUseCaseImpl) GetUser(ctx context.Context, TargetID string) (*commonv1.UserProfile, *commonv1.UserRelationStatus, *commonv1.UserViewCapabilities, error) {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 将请求中的字符串 TargetID 转为整数
	targetID, err := strconv.ParseInt(TargetID, 10, 64)
	if err != nil {
		return nil, nil, nil, err
	}

	// 获取当前用户与目标用户的关系信息
	relation, err := u.UserRepo.GetRelation(ctx, id, targetID)
	if err != nil {
		return nil, nil, nil, err
	}

	// 获取目标用户的信息
	user, err := u.UserRepo.GetMe(ctx, targetID)
	if err != nil {
		return nil, nil, nil, err
	}

	// 获取目标用户的部门信息并转换为返回格式
	dprt, err := u.DepartmentRepo.GetDepartment(ctx, user.Departments)
	if err != nil {
		return nil, nil, nil, err
	}

	// 转换部门数据格式
	departmentBases := make([]*commonv1.DepartmentBase, len(dprt))
	for _, v := range dprt {
		departmentBases = append(departmentBases, v.ToDepartmentBase())
	}

	// 根据隐私设置计算用户可以执行的操作权限
	capability := &commonv1.UserViewCapabilities{}

	// 根据聊天隐私级别判断是否可以聊天
	switch user.Settings.PrivacyChat {
	case userv1.ChatPrivacyLevel_CHAT_PRIVACY_LEVEL_PRIVATE:
		capability.CanChat = id == targetID
	case userv1.ChatPrivacyLevel_CHAT_PRIVACY_LEVEL_PUBLIC:
		capability.CanChat = true
	case userv1.ChatPrivacyLevel_CHAT_PRIVACY_LEVEL_FOLLOWERS:
		capability.CanChat = relation.IsFollowing
	case userv1.ChatPrivacyLevel_CHAT_PRIVACY_LEVEL_MUTUAL:
		capability.CanChat = relation.IsFollowing && relation.IsBeingFollowed
	}

	// 根据收藏帖子隐私级别判断是否可以查看
	switch user.Settings.PrivacyCollectedPosts {
	case userv1.BasePrivacyLevel_BASE_PRIVACY_LEVEL_PRIVATE:
		capability.CanViewCollectedPosts = id == targetID
	case userv1.BasePrivacyLevel_BASE_PRIVACY_LEVEL_PUBLIC:
		capability.CanViewCollectedPosts = true
	}

	// 根据点赞帖子隐私级别判断是否可以查看
	switch user.Settings.PrivacyLikedPosts {
	case userv1.BasePrivacyLevel_BASE_PRIVACY_LEVEL_PRIVATE:
		capability.CanViewLikedPosts = id == targetID
	case userv1.BasePrivacyLevel_BASE_PRIVACY_LEVEL_PUBLIC:
		capability.CanViewLikedPosts = true
	}

	// 返回用户资料、关系状态和操作权限
	return user.ToProfile(relation.Remark, departmentBases), relation.ToUserRelationStatus(), capability, nil
}

// ListUserFollowings 分页获取当前用户关注的用户列表及其关系状态
func (u *UserUseCaseImpl) ListUserFollowings(ctx context.Context, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*userv1.UserListItem, *string, error) {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 根据关注时间获取用户关注列表
	following, cursor, err := u.UserRepo.GetFollowingAuthorsByFollowTime(ctx, id, pagination, filter)
	if err != nil {
		return nil, nil, err
	}

	// 提取关注用户的 ID 列表，供后续批量查询使用
	candidateIDs := make([]int64, len(following))
	for _, v := range following {
		candidateIDs = append(candidateIDs, v.FollowingID)
	}

	// 查询这些候选 ID 中哪些用户也关注当前用户（互关检测）
	mutualFollowings, err := u.UserRepo.GetFollowersIn(ctx, id, candidateIDs)
	if err != nil {
		return nil, nil, err
	}

	// 构建返回的用户列表项，包含用户信息和关系状态
	items := []*userv1.UserListItem{}
	for _, f := range following {
		items = append(items, &userv1.UserListItem{
			Info:           f.Following.ToUserBrief(&f.Remark),
			RelationStatus: &commonv1.UserRelationStatus{IsFollowing: true, IsFollowedBy: mutualFollowings[f.FollowingID] != nil},
		})
	}

	// 返回用户列表及分页游标
	return items, cursor.Cursor, nil
}

// ListUserFollowers 分页获取当前用户的粉丝列表及其关系状态
func (u *UserUseCaseImpl) ListUserFollowers(ctx context.Context, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*userv1.UserListItem, *string, error) {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 根据关注时间获取粉丝列表
	followers, cursor, err := u.UserRepo.GetFansByFollowTime(ctx, id, pagination, filter)
	if err != nil {
		return nil, nil, err
	}

	// 提取粉丝的 ID 列表
	candidateIDs := make([]int64, len(followers))
	for _, v := range followers {
		candidateIDs = append(candidateIDs, v.FollowerID)
	}

	// 查询当前用户是否也关注这些粉丝（用于判断互关）
	mutualFollowings, err := u.UserRepo.GetFollowingsIn(ctx, id, candidateIDs)
	if err != nil {
		return nil, nil, err
	}

	// 构建粉丝列表项，根据互关结果选择不同的数据填充
	items := []*userv1.UserListItem{}
	for _, f := range followers {
		item := &userv1.UserListItem{}
		if m, ok := mutualFollowings[f.FollowerID]; ok {
			// 当前用户也关注了这个粉丝（互关）
			item.Info = f.Follower.ToUserBrief(&m.Remark)
			item.RelationStatus = &commonv1.UserRelationStatus{IsFollowing: true, IsFollowedBy: true}
		} else {
			// 当前用户未关注这个粉丝（单向）
			item.Info = f.Follower.ToUserBrief(nil)
			item.RelationStatus = &commonv1.UserRelationStatus{IsFollowing: false, IsFollowedBy: true}
		}
	}

	// 返回粉丝列表及分页游标
	return items, cursor.Cursor, nil
}

// ListMutualFollowings 分页获取当前用户的互关列表
func (u *UserUseCaseImpl) ListMutualFollowings(ctx context.Context, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*userv1.UserListItem, *string, error) {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 根据时间获取互关列表
	followings, cursor, err := u.UserRepo.GetMutualFollowersByTime(ctx, id, pagination, filter)
	if err != nil {
		return nil, nil, err
	}

	// 构建互关的用户列表项
	items := []*userv1.UserListItem{}
	for _, f := range followings {
		items = append(items, &userv1.UserListItem{
			Info:           f.Following.ToUserBrief(&f.Remark),
			RelationStatus: &commonv1.UserRelationStatus{IsFollowing: true, IsFollowedBy: true},
		})
	}

	// 返回互关列表及分页游标
	return items, cursor.Cursor, nil
}

// SetFollow 设置当前用户对目标用户的关注状态
func (u *UserUseCaseImpl) SetFollow(ctx context.Context, TargetID string, isFollowing bool) error {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 将字符串ID转换为整数
	targetID, err := strconv.ParseInt(TargetID, 10, 64)
	if err != nil {
		return err
	}

	// 防止用户关注自己
	if targetID == id {
		return fmt.Errorf("无法关注自己")
	}

	// 根据 isFollowing 参数执行关注或取消关注操作
	if isFollowing {
		err = u.UserRepo.SetFollow(ctx, id, targetID)
	} else {
		err = u.UserRepo.UnFollow(ctx, id, targetID)
	}

	if err != nil {
		return err
	}

	return nil
}

// EditLinks 编辑当前用户的个性链接信息
func (u *UserUseCaseImpl) EditLinks(ctx context.Context, links []*commonv1.Link) error {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 将 API 层的 Link 转换为内部 model.LinkItem
	linkItems := make([]model.LinkItem, len(links))
	for i, link := range links {
		linkItems[i] = model.LinkItem{
			Label: link.Label,
			URL:   link.Url,
		}
	}

	// 更新用户的链接信息
	return u.UserRepo.UpdateLinks(ctx, id, linkItems)
}

// ChangeName 修改当前用户的昵称
func (u *UserUseCaseImpl) ChangeName(ctx context.Context, newName string) error {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	if len(newName) == 0 {
		return fmt.Errorf("昵称不能为空")
	}
	if len(newName) > 12 {
		return fmt.Errorf("昵称长度不能超过12个字符")
	}

	// 更新用户昵称到仓库
	return u.UserRepo.UpdateName(ctx, id, newName)
}

// ChangeAvatar 修改当前用户的头像
func (u *UserUseCaseImpl) ChangeAvatar(ctx context.Context, avatarUrl string) error {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 更新用户头像 URL 到仓库
	return u.UserRepo.UpdateAvatar(ctx, id, avatarUrl)
}

// UpdateSettings 更新当前用户的各项设置（通知、隐私、内容分类等）
func (u *UserUseCaseImpl) UpdateSettings(ctx context.Context, settings *userv1.SyncedUserSettings) error {
	// 从上下文中提取当前用户ID
	var id int64
	id, _ = ctx.Value("user_id").(int64)

	// 将 API 层的设置转换为内部模型结构
	s := &model.UserSettings{}

	// 提取并赋值通知设置
	if settings.Notification != nil {
		s.Notification = *settings.Notification
	}

	// 提取并赋值隐私设置（聊天、收藏、点赞等权限）
	if settings.Privacy != nil {
		s.PrivacyChat = settings.Privacy.ChatPermission
		s.PrivacyCollectedPosts = settings.Privacy.CollectedPostsVisibility
		s.PrivacyLikedPosts = settings.Privacy.LikedPostsVisibility
	}

	// 提取并赋值内容分类顺序
	if settings.ContentCategoryOrder != nil {
		s.ContentCategoryOrder = settings.ContentCategoryOrder.CategoryIds
	}

	// 持久化用户设置
	return u.UserRepo.UpdateSettings(ctx, id, s)
}

// ListUserPosts 分页获取指定用户发布的帖子预览列表
func (u *UserUseCaseImpl) ListUserPosts(ctx context.Context, UserID string, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*postv1.PostPreview, *string, error) {
	// 将字符串用户ID转换为整数
	id, err := strconv.ParseInt(UserID, 10, 64)
	if err != nil {
		return nil, nil, err
	}

	// 按时间从帖子仓库获取该用户发布的帖子
	posts, cursor, err := u.PostRepo.GetUserPostsByTime(ctx, id, pagination, filter)
	if err != nil {
		return nil, nil, err
	}

	// 提取帖子 ID 列表，用于批量查询封面
	postIds := make([]int64, len(posts))
	for i, post := range posts {
		postIds[i] = post.ID
	}

	// 批量获取封面媒体以便生成预览
	covers, err := u.PostRepo.GetCovers(ctx, postIds)
	if err != nil {
		return nil, nil, err
	}

	// 提取作者 ID 列表用于获取备注信息
	authorIds := make([]int64, len(posts))
	for i, post := range posts {
		authorIds[i] = post.AuthorID
	}

	// 获取当前用户对这些作者的备注（用于显示备注名）
	remarks, err := u.UserRepo.GetRemarksOf(ctx, id, authorIds)
	if err != nil {
		return nil, nil, err
	}

	// 构建帖子预览列表
	previews := make([]*postv1.PostPreview, len(postIds))
	for i, post := range posts {
		previews[i] = post.ToPreview(covers[post.ID].ToMediaAsset(), post.Author.ToUserBrief(remarks[post.AuthorID]))
	}

	// 返回帖子预览列表及分页游标
	return previews, cursor.Cursor, nil
}

// ListUserLikedPosts 分页获取指定用户点赞的帖子预览列表
func (u *UserUseCaseImpl) ListUserLikedPosts(ctx context.Context, UserID string, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*postv1.PostPreview, *string, error) {
	// 将字符串用户ID转换为整数
	id, err := strconv.ParseInt(UserID, 10, 64)
	if err != nil {
		return nil, nil, err
	}

	// 根据时间获取用户点赞的帖子列表
	posts, cursor, err := u.PostRepo.GetUserLikedPosts(ctx, id, pagination, filter)
	if err != nil {
		return nil, nil, err
	}

	// 提取帖子ID列表用于批量获取封面
	postIds := make([]int64, len(posts))
	for i, post := range posts {
		postIds[i] = post.ID
	}

	// 批量获取帖子封面信息
	covers, err := u.PostRepo.GetCovers(ctx, postIds)
	if err != nil {
		return nil, nil, err
	}

	// 提取作者ID列表用于获取备注信息
	authorIds := make([]int64, len(posts))
	for i, post := range posts {
		authorIds[i] = post.AuthorID
	}

	// 获取当前用户对各作者的备注信息
	remarks, err := u.UserRepo.GetRemarksOf(ctx, id, authorIds)
	if err != nil {
		return nil, nil, err
	}

	// 构建帖子预览对象列表
	previews := make([]*postv1.PostPreview, len(postIds))
	for i, post := range posts {
		previews[i] = post.ToPreview(covers[post.ID].ToMediaAsset(), post.Author.ToUserBrief(remarks[post.AuthorID]))
	}

	// 返回帖子预览列表及分页游标
	return previews, cursor.Cursor, nil
}

// ListUserCollectedPosts 分页获取指定用户收藏的帖子预览列表
func (u *UserUseCaseImpl) ListUserCollectedPosts(ctx context.Context, UserID string, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*postv1.PostPreview, *string, error) {
	// 将字符串用户ID转换为整数
	id, err := strconv.ParseInt(UserID, 10, 64)
	if err != nil {
		return nil, nil, err
	}

	// 根据时间获取用户收藏的帖子列表
	posts, cursor, err := u.PostRepo.GetUserCollectedPosts(ctx, id, pagination, filter)
	if err != nil {
		return nil, nil, err
	}

	// 提取帖子ID列表用于批量获取封面
	postIds := make([]int64, len(posts))
	for i, post := range posts {
		postIds[i] = post.ID
	}

	// 批量获取帖子封面信息
	covers, err := u.PostRepo.GetCovers(ctx, postIds)
	if err != nil {
		return nil, nil, err
	}

	// 提取作者ID列表用于获取备注信息
	authorIds := make([]int64, len(posts))
	for i, post := range posts {
		authorIds[i] = post.AuthorID
	}

	// 获取当前用户对各作者的备注信息
	remarks, err := u.UserRepo.GetRemarksOf(ctx, id, authorIds)
	if err != nil {
		return nil, nil, err
	}

	// 构建帖子预览对象列表
	previews := make([]*postv1.PostPreview, len(postIds))
	for i, post := range posts {
		previews[i] = post.ToPreview(covers[post.ID].ToMediaAsset(), post.Author.ToUserBrief(remarks[post.AuthorID]))
	}

	// 返回帖子预览列表及分页游标
	return previews, cursor.Cursor, nil
}
