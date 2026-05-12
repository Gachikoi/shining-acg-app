package user

import (
	"context"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
	userv1 "app.shiningacg.club/gen/proto/api/main/user/v1"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/internal/utils"
	"gorm.io/gorm"
)

// 注：GetFollowingAuthorsByTimeCursor结构体定义在cursor.go文件中，用于处理关注用户列表的游标分页

// FollowingRelation 关注关系临时结构体，包含关注记录和被关注用户信息
type FollowingRelation struct {
	IsFollowing     bool
	IsBeingFollowed bool
	Remark          *string
}

func (f *FollowingRelation) ToUserRelationStatus() *commonv1.UserRelationStatus {
	return &commonv1.UserRelationStatus{
		IsFollowing:  f.IsFollowing,
		IsFollowedBy: f.IsBeingFollowed,
	}
}

// UserRepo 用户仓库接口，定义用户相关操作方法
// 注：用户自身相关的操作，待完善
type UserRepo interface {
	GetMe(ctx context.Context, ID int64) (*model.User, error)
	GetRelation(ctx context.Context, ID int64, TargetID int64) (*FollowingRelation, error)
	GetUserIDByQQNum(ctx context.Context, QQNum string) (int64, error)

	GetFollowersIn(ctx context.Context, ID int64, CandidateIDs []int64) (map[int64]*model.Follow, error)
	GetFollowingsIn(ctx context.Context, ID int64, CandidateIDs []int64) (map[int64]*model.Follow, error)
	GetRemarksOf(ctx context.Context, ID int64, TargetIDs []int64) (map[int64]*string, error)

	SetFollow(ctx context.Context, FollowerID int64, FollowingID int64) error
	UnFollow(ctx context.Context, FollowerID int64, FollowingID int64) error

	UpdateName(ctx context.Context, ID int64, Name string) error
	UpdateRemark(ctx context.Context, ID int64, TargetID int64, Remark string) error
	UpdateAvatar(ctx context.Context, ID int64, AvatarURL string) error
	UpdateDepartment(ctx context.Context, ID int64, Departments []int64) error
	UpdateLinks(ctx context.Context, ID int64, Links []model.LinkItem) error
	UpdateSettings(ctx context.Context, ID int64, Settings *model.UserSettings) error

	GetFollowingAuthorsByFollowTime(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*model.Follow, *commonv1.CursorPagination, error)
	GetFansByFollowTime(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*model.Follow, *commonv1.CursorPagination, error)
	GetMutualFollowersByTime(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*model.Follow, *commonv1.CursorPagination, error)
	GetFollowingAuthorsByLatestPost(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*model.Follow, *commonv1.CursorPagination, error)
}

// UserRepoImpl 用户仓库实现
// 注：使用GORM进行数据库操作
type UserRepoImpl struct {
	DB *gorm.DB // 数据库连接
}

// 确保UserRepoImpl实现了UserRepo接口
var _ UserRepo = (*UserRepoImpl)(nil)

func NewUserRepo(DB *gorm.DB) *UserRepoImpl {
	// 创建 UserRepoImpl 并注入 GORM DB
	return &UserRepoImpl{DB: DB}
}

func (u *UserRepoImpl) GetMe(ctx context.Context, ID int64) (*model.User, error) {
	var user model.User
	// 使用 Preload 加载关联的用户设置
	err := u.DB.WithContext(ctx).Preload("UserSettings").First(&user, ID).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (u *UserRepoImpl) GetRelation(ctx context.Context, ID int64, TargetID int64) (*FollowingRelation, error) {
	relation := &FollowingRelation{}
	var follows []*model.Follow

	// 一次性查出 A->B 和 B->A 的记录
	err := u.DB.WithContext(ctx).
		Where("(follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)",
			ID, TargetID, TargetID, ID).
		Find(&follows).Error

	if err != nil {
		return nil, err // 务必处理错误
	}

	for _, f := range follows {
		if f.FollowerID == ID && f.FollowingID == TargetID {
			relation.IsFollowing = true
			relation.Remark = &f.Remark // 假设 FollowingRelation 有这个字段
		}
		if f.FollowerID == TargetID && f.FollowingID == ID {
			relation.IsBeingFollowed = true
		}
	}

	return relation, nil
}

/* func (u *UserRepoImpl) GetUser(ctx context.Context, ID int64, TargetID int64) (*model.Follow, error) {
	var f *model.Follow
	err := u.DB.WithContext(ctx).Preload("User.UserSettings").First(&f, TargetID).Error
	if err != nil {
		return nil, err
	}
	return &f, nil
} */

func (u *UserRepoImpl) GetUserIDByQQNum(ctx context.Context, QQNum string) (int64, error) {
	var userID int64
	// 根据 qq_number 查询用户 ID
	err := u.DB.WithContext(ctx).Model(&model.User{}).Where("qq_number = ?", QQNum).Pluck("id", &userID).Error
	if err != nil {
		return 0, err
	}
	return userID, nil
}

func (u *UserRepoImpl) GetFollowersIn(ctx context.Context, ID int64, CandidateIDs []int64) (map[int64]*model.Follow, error) {
	var followers []*model.Follow
	// 查询 CandidateIDs 中哪些是当前用户的关注者（即这些 ID 是否关注当前用户）
	err := u.DB.WithContext(ctx).Where("following_id = ? AND follower_id IN ?", ID, CandidateIDs).Find(&followers).Error
	if err != nil {
		return nil, err
	}
	followerMap := make(map[int64]*model.Follow)
	for _, follower := range followers {
		followerMap[follower.FollowerID] = follower
	}
	return followerMap, nil
}

func (u *UserRepoImpl) GetFollowingsIn(ctx context.Context, ID int64, CandidateIDs []int64) (map[int64]*model.Follow, error) {
	var followings []*model.Follow
	// 查询 CandidateIDs 中哪些是当前用户关注的用户
	err := u.DB.WithContext(ctx).Where("follower_id = ? AND following_id IN ?", ID, CandidateIDs).Find(&followings).Error
	if err != nil {
		return nil, err
	}
	followingMap := make(map[int64]*model.Follow)
	for _, following := range followings {
		followingMap[following.FollowingID] = following
	}
	return followingMap, nil
}

func (u *UserRepoImpl) SetFollow(ctx context.Context, FollowerID int64, FollowingID int64) error {
	// 创建关注记录
	return u.DB.WithContext(ctx).Create(&model.Follow{FollowerID: FollowerID, FollowingID: FollowingID}).Error
}

func (u *UserRepoImpl) UnFollow(ctx context.Context, FollowerID int64, FollowingID int64) error {
	// 删除关注记录
	return u.DB.WithContext(ctx).Delete(&model.Follow{}, "follower_id = ? AND following_id = ?", FollowerID, FollowingID).Error
}

func (u *UserRepoImpl) UpdateName(ctx context.Context, ID int64, Name string) error {
	// 更新用户昵称字段
	return u.DB.WithContext(ctx).Model(&model.User{}).Where("id = ?", ID).Update("name", Name).Error
}

func (u *UserRepoImpl) UpdateRemark(ctx context.Context, ID int64, TargetID int64, Remark string) error {
	// 更新关注关系中的备注字段
	return u.DB.WithContext(ctx).Model(&model.Follow{}).Where("following_id = ? AND follower_id = ?", TargetID, ID).Update("remark", Remark).Error
}

func (u *UserRepoImpl) UpdateAvatar(ctx context.Context, ID int64, AvatarURL string) error {
	// 更新用户头像 URL
	return u.DB.WithContext(ctx).Model(&model.User{}).Where("id = ?", ID).Update("avatar_url", AvatarURL).Error
}

// TODO
func (u *UserRepoImpl) UpdateDepartment(ctx context.Context, ID int64, Departments []int64) error {
	// 更新用户所属部门（TODO: 确认字段存储格式）
	return u.DB.WithContext(ctx).Model(&model.User{}).Where("id = ?", ID).Update("departments", Departments).Error
}

func (u *UserRepoImpl) UpdateLinks(ctx context.Context, ID int64, Links []model.LinkItem) error {
	// 更新用户个性链接字段
	return u.DB.WithContext(ctx).Model(&model.User{}).Where("id = ?", ID).Update("links", Links).Error
}

func (u *UserRepoImpl) UpdateSettings(ctx context.Context, ID int64, Settings *model.UserSettings) error {
	// 更新用户设置（写入 user_settings 表或关联结构）
	return u.DB.WithContext(ctx).Model(&model.UserSettings{}).Where("id = ?", ID).Updates(Settings).Error
}

func (u *UserRepoImpl) GetRemarksOf(ctx context.Context, ID int64, TargetIDs []int64) (map[int64]*string, error) {
	var follows []*model.Follow
	// 查询当前用户对 TargetIDs 的备注信息
	err := u.DB.WithContext(ctx).Where("follower_id = ? AND following_id IN ?", ID, TargetIDs).Find(&follows).Error
	if err != nil {
		return nil, err
	}

	remarks := make(map[int64]*string)
	for _, f := range follows {
		remarks[f.FollowingID] = &f.Remark
	}

	return remarks, nil
}

func (u *UserRepoImpl) GetFollowingAuthorsByFollowTime(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*model.Follow, *commonv1.CursorPagination, error) {
	var followings []*model.Follow
	var cursor *utils.ByTimeCursor = &utils.ByTimeCursor{}
	cursor.Decode(pagination)

	// 执行按关注时间分页的查询并预加载关注用户
	err := u.followingBaseQuery(ctx).
		Where("f.follower_id = ?", ID).
		Scopes(utils.PaginateByTime(cursor, "f.created_at", "f.following_id")).
		Find(&followings).
		Preload("Following").Error

	if err != nil {
		return nil, nil, err
	}

	if len(followings) != 0 {
		last := followings[len(followings)-1]
		cursor.Time = last.CreatedAt
		cursor.ID = last.FollowingID
	}

	return followings, cursor.Encode(), nil
}

func (u *UserRepoImpl) GetFansByFollowTime(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*model.Follow, *commonv1.CursorPagination, error) {
	var followers []*model.Follow
	var cursor *utils.ByTimeCursor = &utils.ByTimeCursor{}
	cursor.Decode(pagination)

	// 执行按关注时间分页的粉丝查询并预加载粉丝信息
	err := u.followerBaseQuery(ctx).
		Where("f.following_id = ?", ID).
		Scopes(utils.PaginateByTime(cursor, "f.created_at", "f.follower_id")).
		Find(&followers).
		Preload("Follower").Error

	if err != nil {
		return nil, nil, err
	}

	if len(followers) != 0 {
		last := followers[len(followers)-1]
		cursor.Time = last.CreatedAt
		cursor.ID = last.FollowerID
	}

	return followers, cursor.Encode(), nil
}

func (u *UserRepoImpl) GetMutualFollowersByTime(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*model.Follow, *commonv1.CursorPagination, error) {
	var followings []*model.Follow
	var cursor *utils.ByTimeCursor = &utils.ByTimeCursor{}
	cursor.Decode(pagination)

	// 查询互关（A 关注 B 且 B 关注 A），并按时间分页
	err := u.followingBaseQuery(ctx).
		Where("f.follower_id = ?", ID).
		Joins("JOIN follows e ON e.follower_id = f.following_id").
		Where("e.following_id = ?", ID).
		Scopes(utils.PaginateByTime(cursor, "f.created_at", "f.following_id")).
		Find(&followings).
		Preload("Following").Error

	if err != nil {
		return nil, nil, err
	}

	if len(followings) != 0 {
		last := followings[len(followings)-1]
		cursor.Time = last.CreatedAt
		cursor.ID = last.FollowingID
	}

	return followings, cursor.Encode(), nil

}

func (u *UserRepoImpl) GetFollowingAuthorsByLatestPost(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.UserFilter) ([]*model.Follow, *commonv1.CursorPagination, error) {
	var followings []*model.Follow
	var cursor *utils.ByTimeCursor = &utils.ByTimeCursor{}
	cursor.Decode(pagination)

	// 按被关注者最近发帖时间排序，以获取有新内容的关注作者列表
	err := u.followingBaseQuery(ctx).
		Where("f.follower_id = ?", ID).
		Scopes(utils.PaginateByTime(cursor, "u.last_post_at", "u.id")).
		Find(&followings).
		Preload("Following").Error

	if err != nil {
		return nil, nil, err
	}

	if len(followings) != 0 {
		last := followings[len(followings)-1]
		cursor.Time = last.CreatedAt
		cursor.ID = last.FollowingID
	}

	return followings, cursor.Encode(), nil
}
