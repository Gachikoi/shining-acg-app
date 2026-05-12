package post

import (
	"context"
	"time"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
	userv1 "app.shiningacg.club/gen/proto/api/main/user/v1"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/internal/utils"
	"gorm.io/gorm"
)

// PostPreviewInfo 帖子预览信息，包含帖子、作者和封面媒体
type PostPreviewInfo struct {
	Post        []*model.Post               // 帖子信息
	Cover       map[int64]*model.MediaAsset // 封面媒体，可为空
	isLiked     map[int64]bool              // 当前用户是否点赞
	isCollected map[int64]bool              // 当前用户是否收藏
}

// PostRepo 帖子仓库接口
// 定义帖子相关的数据库操作方法
type PostRepo interface {
	IsLiked(ctx context.Context, userID int64, TargetType model.InteractionTargetType, TargetIDs []int64) (map[int64]bool, error)
	IsCollected(ctx context.Context, userID int64, TargetType model.InteractionTargetType, TargetIDs []int64) (map[int64]bool, error)
	GetCovers(ctx context.Context, postIDs []int64) (map[int64]*model.MediaAsset, error)

	GetUserLikedPosts(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*model.Post, *commonv1.CursorPagination, error)
	GetUserCollectedPosts(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*model.Post, *commonv1.CursorPagination, error)
	GetUserPostsByTime(ctx context.Context, userID int64, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*model.Post, *commonv1.CursorPagination, error)

	GetFollowingPostsTimeline(ctx context.Context, userID int64, pagination *commonv1.CursorPagination) ([]*model.Post, *commonv1.CursorPagination, error)
}

// PostRepoImpl 帖子仓库实现
type PostRepoImpl struct {
	DB *gorm.DB // 数据库连接
}

// 确保PostRepoImpl实现了PostRepo接口
var _ PostRepo = (*PostRepoImpl)(nil)

func NewPostRepo(DB *gorm.DB) *PostRepoImpl {
	return &PostRepoImpl{
		DB: DB,
	}
}

func (p *PostRepoImpl) IsLiked(ctx context.Context, userID int64, TargetType model.InteractionTargetType, TargetIDs []int64) (map[int64]bool, error) {
	// 查询当前用户对 TargetIDs 的点赞行为
	likedPosts := make(map[int64]bool)
	var interactions []model.Interaction

	if err := p.DB.WithContext(ctx).
		Where("user_id = ? AND target_type = ? AND action_type = ? AND target_id IN ?", userID, TargetType, model.InteractionActionLike, TargetIDs).
		Find(&interactions).Error; err != nil {
		return nil, err
	}

	// 将查询结果映射为 map[targetID]bool
	for _, interaction := range interactions {
		likedPosts[interaction.TargetID] = true
	}
	return likedPosts, nil
}

func (p *PostRepoImpl) IsCollected(ctx context.Context, userID int64, TargetType model.InteractionTargetType, TargetIDs []int64) (map[int64]bool, error) {
	// 查询当前用户对 TargetIDs 的收藏行为
	collectedPosts := make(map[int64]bool)
	var interactions []model.Interaction
	if err := p.DB.WithContext(ctx).
		Where("user_id = ? AND target_type = ? AND action_type = ? AND target_id IN ?", userID, TargetType, model.InteractionActionCollect, TargetIDs).
		Find(&interactions).Error; err != nil {
		return nil, err
	}
	// 映射结果为 map[targetID]bool
	for _, interaction := range interactions {
		collectedPosts[interaction.TargetID] = true
	}
	return collectedPosts, nil
}

func (p *PostRepoImpl) GetCovers(ctx context.Context, postIDs []int64) (map[int64]*model.MediaAsset, error) {
	// 批量查询封面媒体并按 ID 建立映射
	coverMap := make(map[int64]*model.MediaAsset)
	var covers []model.MediaAsset
	if err := p.DB.WithContext(ctx).
		Where("id IN ?", postIDs).
		Preload("Files").
		Find(&covers).Error; err != nil {
		return nil, err
	}
	for i := range covers {
		coverMap[covers[i].ID] = &covers[i]
	}
	return coverMap, nil
}

func (p *PostRepoImpl) GetUserLikedPosts(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*model.Post, *commonv1.CursorPagination, error) {
	var posts []*model.Post
	var cursor *utils.ByTimeCursor = &utils.ByTimeCursor{}
	cursor.Decode(pagination)

	type result struct {
		Post    *model.Post
		LikedAt time.Time
	}
	var results []result

	// 查询用户点赞的帖子，按点赞时间进行分页并预加载作者
	err := p.DB.WithContext(ctx).
		Table("posts p").
		Joins("JOIN interactions i ON i.target_id = p.id").
		Where("i.user_id = ? AND i.target_type = ? AND i.action_type = ?", ID, model.InteractionTargetPost, model.InteractionActionLike).
		Scopes(utils.PaginateByTime(cursor, "i.created_at", "i.target_id")).
		Scopes(utils.WithKeyWord("p.title", filter.GetKeyword())).
		Select("p.*, i.created_at as liked_at").
		Preload("Author").
		Find(&results).Error
	if err != nil {
		return nil, nil, err
	}

	if len(results) != 0 {
		last := results[len(results)-1]
		cursor.Time = last.LikedAt
		cursor.ID = last.Post.ID
	}

	// 从查询结果中提取 Post 对象
	for _, v := range results {
		posts = append(posts, v.Post)
	}

	return posts, cursor.Encode(), nil
}

func (p *PostRepoImpl) GetUserCollectedPosts(ctx context.Context, ID int64, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*model.Post, *commonv1.CursorPagination, error) {
	var posts []*model.Post
	var cursor *utils.ByTimeCursor = &utils.ByTimeCursor{}
	cursor.Decode(pagination)

	type result struct {
		Post        *model.Post
		CollectedAt time.Time
	}
	var results []result

	// 查询用户收藏的帖子，按收藏时间分页
	err := p.DB.WithContext(ctx).
		Table("posts p").
		Joins("JOIN interactions i ON i.target_id = p.id").
		Where("i.user_id = ? AND i.target_type = ? AND i.action_type = ?", ID, model.InteractionTargetPost, model.InteractionActionCollect).
		Scopes(utils.PaginateByTime(cursor, "i.created_at", "i.target_id")).
		Scopes(utils.WithKeyWord("p.title", filter.GetKeyword())).
		Select("p.*, i.created_at as collected_at").
		Preload("Author").
		Find(&results).Error
	if err != nil {
		return nil, nil, err
	}

	if len(results) != 0 {
		last := results[len(results)-1]
		cursor.Time = last.CollectedAt
		cursor.ID = last.Post.ID
	}

	// 将结果组装为 posts 列表
	for _, v := range results {
		posts = append(posts, v.Post)
	}

	return posts, cursor.Encode(), nil
}

func (p *PostRepoImpl) GetUserPostsByTime(ctx context.Context, userID int64, pagination *commonv1.CursorPagination, filter *userv1.PostFilter) ([]*model.Post, *commonv1.CursorPagination, error) {
	var posts []*model.Post
	var cursor *utils.ByTimeCursor = &utils.ByTimeCursor{}
	cursor.Decode(pagination)

	// 查询某用户按创建时间排序的帖子列表，并预加载作者信息
	err := p.DB.WithContext(ctx).
		Table("posts p").
		Where("p.author_id = ?", userID).
		Scopes(utils.PaginateByTime(cursor, "p.created_at", "p.id")).
		Scopes(utils.WithKeyWord("p.title", filter.GetKeyword())).
		Preload("Author").
		Find(&posts).Error
	if err != nil {
		return nil, nil, err
	}

	if len(posts) != 0 {
		last := posts[len(posts)-1]
		cursor.Time = last.CreatedAt
		cursor.ID = last.ID
	}

	return posts, cursor.Encode(), nil
}

func (p *PostRepoImpl) GetFollowingPostsTimeline(ctx context.Context, userID int64, pagination *commonv1.CursorPagination) ([]*model.Post, *commonv1.CursorPagination, error) {
	var posts []*model.Post
	var cursor *utils.ByTimeCursor = &utils.ByTimeCursor{}
	cursor.Decode(pagination)

	// 查询关注者的帖子时间线，按帖子创建时间分页
	err := p.DB.WithContext(ctx).
		Table("follows f").
		Joins("JOIN posts p ON p.author_id = f.following_id").
		Where("f.follower_id = ? ", userID).
		Scopes(utils.PaginateByTime(cursor, "p.created_at", "p.id")).
		Select("p.*").
		Preload("Author").
		Find(&posts).Error
	if err != nil {
		return nil, nil, err
	}

	if len(posts) > 0 {
		last := posts[len(posts)-1]
		cursor.Time = last.CreatedAt
		cursor.ID = last.ID
	}

	return posts, cursor.Encode(), err
}
