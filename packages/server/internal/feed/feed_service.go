package feed

import (
	"context"

	feedv1 "app.shiningacg.club/gen/proto/api/main/feed/v1"
	"app.shiningacg.club/gen/proto/api/main/feed/v1/feedv1connect"
	"connectrpc.com/connect"
)

// FeedServiceServer 是 FeedService 的伪实现
type FeedServiceServer struct {
	feedv1connect.UnimplementedFeedServiceHandler
	useCase FeedUseCase
}

// 确保 FeedServiceServer 实现了 FeedServiceHandler 接口
var _ feedv1connect.FeedServiceHandler = (*FeedServiceServer)(nil)

func NewFeedServiceServer(useCase FeedUseCase) *FeedServiceServer {
	// 创建 FeedServiceServer 并注入 UseCase
	return &FeedServiceServer{
		useCase: useCase,
	}
}

func (s *FeedServiceServer) GetFeed(ctx context.Context, req *connect.Request[feedv1.GetFeedRequest]) (*connect.Response[feedv1.GetFeedResponse], error) {
	// TODO: 鉴权组件，获取token组件待实现

	// 根据请求中的 categoryId 分发不同的流获取逻辑
	switch req.Msg.GetCategoryId() {
	case "":
		return nil, connect.NewError(connect.CodeInvalidArgument, nil)
	case SystemFeedCategoryGeneral:
		// TODO: 实现获取综合内容流的逻辑
	case SystemFeedCategoryUser:
		// TODO: 实现获取用户内容流的逻辑
	case SystemFeedCategoryFollowing:
		var feedPosts *feedv1.PostFeedContent
		var cursor *string
		var err error

		if req.Msg.Filter.AuthorId != nil {
			// 如果包含 AuthorId，则返回指定作者的帖子流
			feedPosts, cursor, err = s.useCase.ListUserPostsFeed(ctx, *req.Msg.Filter.AuthorId, req.Msg.GetPagination())
		} else {
			// 否则返回关注的帖子时间线
			feedPosts, cursor, err = s.useCase.ListFollowingPostsFeed(ctx, req.Msg.GetPagination())
		}

		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}

		return connect.NewResponse(&feedv1.GetFeedResponse{
			ContentType: feedv1.FeedContentType_FEED_CONTENT_TYPE_POST,
			Content:     &feedv1.GetFeedResponse_Posts{Posts: feedPosts},
			Cursor:      cursor,
		}), nil

	case SystemFeedCategoryFollowingAuthor:
		// 获取关注的作者内容流
		followingAuthors, cursor, err := s.useCase.ListFollowingAuthorsFeed(ctx, req.Msg.GetPagination())
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}

		return connect.NewResponse(&feedv1.GetFeedResponse{
			ContentType: feedv1.FeedContentType_FEED_CONTENT_TYPE_FOLLOWING_AUTHOR,
			Content:     &feedv1.GetFeedResponse_FollowingAuthors{FollowingAuthors: followingAuthors},
			Cursor:      cursor,
		}), nil

	default:
		// TODO: 其他分区内容推流
	}

	return nil, nil
}

// 获取分区列表
func (s *FeedServiceServer) ListFeedCategories(ctx context.Context, req *connect.Request[feedv1.ListFeedCategoriesRequest]) (*connect.Response[feedv1.ListFeedCategoriesResponse], error) {
	// 调用 UseCase 获取分类列表
	categories, err := s.useCase.ListCategories(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&feedv1.ListFeedCategoriesResponse{
		Categories: categories,
	}), nil
}
