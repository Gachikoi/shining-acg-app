package feed

import (
	"context"
	"strconv"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
	feedv1 "app.shiningacg.club/gen/proto/api/main/feed/v1"
	postv1 "app.shiningacg.club/gen/proto/api/main/post/v1"
	"app.shiningacg.club/internal/partition"
	"app.shiningacg.club/internal/post"
	"app.shiningacg.club/internal/user"
)

// FeedUseCase feed业务逻辑接口
// 定义feed相关的业务操作方法
type FeedUseCase interface {
	ListCategories(context.Context) ([]*feedv1.FeedCategory, error)

	ListFollowingAuthorsFeed(context.Context, *commonv1.CursorPagination) (*feedv1.FollowingAuthorFeedContent, *string, error)
	ListFollowingPostsFeed(context.Context, *commonv1.CursorPagination) (*feedv1.PostFeedContent, *string, error)

	ListUserPostsFeed(context.Context, string, *commonv1.CursorPagination) (*feedv1.PostFeedContent, *string, error)
}

// FeedUseCaseImpl feed业务逻辑实现
type FeedUseCaseImpl struct {
	partitionRepo partition.PartitionRepo // 分区仓库
	userRepo      user.UserRepo           // 用户仓库
	postRepo      post.PostRepo           // 帖子仓库
}

func NewFeedUseCase(partitionRepo partition.PartitionRepo, userRepo user.UserRepo, postRepo post.PostRepo) *FeedUseCaseImpl {
	return &FeedUseCaseImpl{
		partitionRepo: partitionRepo,
		userRepo:      userRepo,
		postRepo:      postRepo,
	}
}

// 确保FeedUseCaseImpl实现了FeedUseCase接口
var _ FeedUseCase = (*FeedUseCaseImpl)(nil)

func (f *FeedUseCaseImpl) ListCategories(ctx context.Context) ([]*feedv1.FeedCategory, error) {

	// 初始化分类切片
	var categories []*feedv1.FeedCategory
	// 从分区仓库获取分区列表
	partList, err := f.partitionRepo.List(ctx)

	if err != nil {
		return nil, err
	}

	// 综合分区
	categories = append(categories, &feedv1.FeedCategory{
		CategoryId:  SystemFeedCategoryGeneral,
		DisplayName: "综合",
		ContentType: feedv1.FeedContentType_FEED_CONTENT_TYPE_POST,
		SortOrder:   0,
		IsSystem:    true,
		Icon:        nil,
	})
	// 用户分区
	categories = append(categories, &feedv1.FeedCategory{
		CategoryId:  SystemFeedCategoryUser,
		DisplayName: "用户",
		ContentType: feedv1.FeedContentType_FEED_CONTENT_TYPE_USER,
		SortOrder:   0,
		IsSystem:    true,
		Icon:        nil,
	})
	// 关注帖子分区
	categories = append(categories, &feedv1.FeedCategory{
		CategoryId:  SystemFeedCategoryFollowing,
		DisplayName: "关注",
		ContentType: feedv1.FeedContentType_FEED_CONTENT_TYPE_POST,
		SortOrder:   0,
		IsSystem:    true,
		Icon:        nil,
	})
	// 关注作者分区
	categories = append(categories, &feedv1.FeedCategory{
		CategoryId:  SystemFeedCategoryFollowingAuthor,
		DisplayName: "关注作者",
		ContentType: feedv1.FeedContentType_FEED_CONTENT_TYPE_FOLLOWING_AUTHOR,
		SortOrder:   0,
		IsSystem:    true,
		Icon:        nil,
	})

	// 分区帖子流部分：将每个分区转换为 FeedCategory
	for _, v := range partList.Partitions {
		categories = append(categories, &feedv1.FeedCategory{
			CategoryId:  strconv.Itoa(int(v.ID)),
			DisplayName: v.Name,
			ContentType: feedv1.FeedContentType_FEED_CONTENT_TYPE_POST,
			SortOrder:   v.SortOrder,
			IsSystem:    false,
			Icon:        nil, // 目前无图标
		})

	}
	return categories, nil
}

func (f *FeedUseCaseImpl) ListFollowingAuthorsFeed(ctx context.Context, pagination *commonv1.CursorPagination) (*feedv1.FollowingAuthorFeedContent, *string, error) {
	// 从上下文取当前用户ID（占位，真实鉴权组件待接入）
	id := ctx.Value("id").(int64)

	// 获取关注作者列表，按其最近发帖时间排序
	followings, cursor, err := f.userRepo.GetFollowingAuthorsByLatestPost(ctx, id, pagination, nil)
	if err != nil {
		return &feedv1.FollowingAuthorFeedContent{}, nil, err
	}

	// 构建返回的作者预览列表
	items := make([]*postv1.FollowingAuthor, len(followings))
	for i, v := range followings {
		hasUnread := false
		if !v.Following.LastPostAt.IsZero() {
			hasUnread = v.LastReadAt.Before(v.Following.LastPostAt)
		}
		items[i] = &postv1.FollowingAuthor{
			Author:    v.Following.ToUserBrief(&v.Remark),
			HasUnread: hasUnread,
		}
	}

	return &feedv1.FollowingAuthorFeedContent{
		Items: items,
	}, cursor.Cursor, nil
}

func (f *FeedUseCaseImpl) ListFollowingPostsFeed(ctx context.Context, pagination *commonv1.CursorPagination) (*feedv1.PostFeedContent, *string, error) {
	// 从上下文取当前用户ID（占位）
	id := ctx.Value("id").(int64)

	// 获取关注用户的时间线帖子
	posts, cursor, err := f.postRepo.GetFollowingPostsTimeline(ctx, id, pagination)
	if err != nil {
		return &feedv1.PostFeedContent{}, nil, err
	}

	// 提取帖子ID和作者ID，用于后续批量查询
	postIds := make([]int64, len(posts))
	authorIds := make([]int64, len(posts))
	for i, v := range posts {
		postIds[i] = v.ID
		authorIds[i] = v.Author.ID
	}

	// 批量获取帖子封面
	covers, err := f.postRepo.GetCovers(ctx, postIds)
	if err != nil {
		return nil, nil, err
	}

	// 获取当前用户对这些作者的备注信息
	remarks, err := f.userRepo.GetRemarksOf(ctx, id, authorIds)
	if err != nil {
		return nil, nil, err
	}

	// 构建帖子预览列表
	items := make([]*postv1.PostPreview, len(posts))
	for i, v := range posts {
		items[i] = v.ToPreview(covers[v.ID].ToMediaAsset(), v.Author.ToUserBrief(remarks[v.AuthorID]))
	}

	return &feedv1.PostFeedContent{
		Items: items,
	}, cursor.Cursor, nil
}

func (f *FeedUseCaseImpl) ListUserPostsFeed(ctx context.Context, AuthorID string, pagination *commonv1.CursorPagination) (*feedv1.PostFeedContent, *string, error) {
	// 从上下文取当前用户ID（占位）
	id := ctx.Value("id").(int64)

	// 将请求中的字符串作者ID转换为整数
	authorID, err := strconv.ParseInt(AuthorID, 10, 64)
	if err != nil {
		return &feedv1.PostFeedContent{}, nil, err
	}

	// 获取指定作者按时间排序的帖子
	posts, cursor, err := f.postRepo.GetUserPostsByTime(ctx, authorID, pagination, nil)
	if err != nil {
		return &feedv1.PostFeedContent{}, nil, err
	}

	// 提取帖子ID与作者ID
	postIds := make([]int64, len(posts))
	authorIds := make([]int64, len(posts))
	for i, v := range posts {
		postIds[i] = v.ID
		authorIds[i] = v.Author.ID
	}

	covers, err := f.postRepo.GetCovers(ctx, postIds)
	if err != nil {
		return nil, nil, err
	}

	remarks, err := f.userRepo.GetRemarksOf(ctx, id, authorIds)
	if err != nil {
		return nil, nil, err
	}

	items := make([]*postv1.PostPreview, len(posts))
	for i, v := range posts {
		items[i] = v.ToPreview(covers[v.ID].ToMediaAsset(), v.Author.ToUserBrief(remarks[v.AuthorID]))
	}

	return &feedv1.PostFeedContent{
		Items: items,
	}, cursor.Cursor, nil
}
