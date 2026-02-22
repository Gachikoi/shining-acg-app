package biz

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"app.shiningacg.club/gen/proto/api/common/v1"
	"app.shiningacg.club/internal/repo"
	"app.shiningacg.club/pkg/ffmpeg"
	"app.shiningacg.club/pkg/logger"
	"app.shiningacg.club/pkg/pathutil"
	"github.com/bwmarrin/snowflake"
)

// MediaStatus 媒体状态枚举
const (
	MediaStatusProcessing = 0 // 处理中
	MediaStatusCompleted  = 1 // 已完成
	MediaStatusBlocked    = 2 // 违规屏蔽
	MediaStatusFailed     = 4 // 处理失败
)

// ResourceUseCase 资源用例
type ResourceUseCase struct {
	repo repo.ResourceRepo
	s3   *S3Client
	node *snowflake.Node
	pool *ffmpeg.WorkerPool
}

// NewResourceUseCase 创建资源用例实例
func NewResourceUseCase(repo repo.ResourceRepo, s3 *S3Client, node *snowflake.Node, pool *ffmpeg.WorkerPool) *ResourceUseCase {
	return &ResourceUseCase{
		repo: repo,
		s3:   s3,
		node: node,
		pool: pool,
	}
}

// CreateUploadTask 创建上传任务
func (uc *ResourceUseCase) CreateUploadTask(ctx context.Context, scene commonv1.ResourceScene, task *commonv1.UploadTask) (*commonv1.UploadToken, error) {
	// 生成媒体 ID
	mediaID := uc.node.Generate().Int64()

	// 根据配置获取存储类别
	category, err := getCategoryByScene(scene)
	if err != nil {
		return nil, err
	}

	objectKey := pathutil.GenerateObjectKey(mediaID, category, task.Filename)

	// 生成预签名 URL
	expire := time.Hour * 24 // 24小时过期
	uploadURL, headers, err := uc.s3.genPresignedURL(ctx, objectKey, expire)
	if err != nil {
		return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	// 构造返回结果
	return &commonv1.UploadToken{
		TaskId:          fmt.Sprintf("%d", mediaID),
		UploadUrl:       uploadURL,
		PublicUrl:       uc.s3.getObjectURL(objectKey),
		RequiredHeaders: headers,
		SkipUpload:      false, // 暂时不实现秒传
	}, nil
}

// CompleteUpload 完成上传并触发处理
func (uc *ResourceUseCase) CompleteUpload(ctx context.Context, req *commonv1.CompleteUploadRequest) (*commonv1.CompleteUploadResponse, error) {
	// 解析媒体 ID
	mediaID, err := parseTaskID(req.TaskId)
	if err != nil {
		return nil, fmt.Errorf("invalid task_id: %w", err)
	}

	// 根据场景确定资源类型
	var mediaType commonv1.MediaType
	switch req.Scene {
	case commonv1.ResourceScene_SCENE_USER_AVATAR,
		commonv1.ResourceScene_SCENE_POST_IMAGE,
		commonv1.ResourceScene_SCENE_COMMENT_IMAGE,
		commonv1.ResourceScene_SCENE_POST_COVER:
		mediaType = commonv1.MediaType_MEDIA_TYPE_IMAGE
	case commonv1.ResourceScene_SCENE_POST_VIDEO:
		mediaType = commonv1.MediaType_MEDIA_TYPE_VIDEO
	default:
		return nil, fmt.Errorf("unsupported resource scene: %v", req.Scene)
	}

	// 创建媒体资源记录
	media := &commonv1.Media{
		Id:        fmt.Sprintf("%d", mediaID),
		Type:      mediaType,
		Bucket:    uc.s3.bucket,
		ObjectKey: req.ObjectKey,
		Status:    int32(MediaStatusProcessing),
	}

	// 保存到数据库
	err = uc.repo.Save(ctx, media)
	if err != nil {
		return nil, fmt.Errorf("failed to save media: %w", err)
	}

	// 根据类型处理
	if mediaType == commonv1.MediaType_MEDIA_TYPE_IMAGE {
		// 图片处理（同步）
		cropCover := req.GetCropCover()
		err = uc.processImage(ctx, mediaID, req.ObjectKey, req.Scene, cropCover)
		if err != nil {
			return nil, fmt.Errorf("failed to process image: %w", err)
		}

		return &commonv1.CompleteUploadResponse{
			ResourceId: mediaID,
			Status:     "COMPLETED",
		}, nil
	} else {
		// 视频处理（异步）
		// 使用 context.Background() 避免请求上下文取消导致异步处理失败
		// 但我们需要保留原始上下文的 trace_id 以便追踪
		traceID := logger.FromContext(ctx)
		go func() {
			asyncCtx := logger.WithTraceID(context.Background(), traceID)
			err := uc.processVideo(asyncCtx, mediaID, req.ObjectKey)
			if err != nil {
				slog.ErrorContext(asyncCtx, "failed to process video",
					slog.Int64("media_id", mediaID),
					slog.Any("error", err),
				)
				if updateErr := uc.repo.UpdateStatus(asyncCtx, mediaID, int32(MediaStatusFailed)); updateErr != nil {
					slog.ErrorContext(asyncCtx, "failed to update video status",
						slog.Int64("media_id", mediaID),
						slog.Any("error", updateErr),
					)
				}
			}
		}()

		return &commonv1.CompleteUploadResponse{
			ResourceId: mediaID,
			Status:     "PROCESSING",
		}, nil
	}
}

// GetUploadStatus 获取上传状态
func (uc *ResourceUseCase) GetUploadStatus(ctx context.Context, taskID string) (*commonv1.GetUploadStatusResponse, error) {
	media, status, err := uc.getMediaByID(ctx, taskID)
	if err != nil {
		return nil, err
	}

	return uc.buildGetUploadStatusResponse(media, status), nil
}
