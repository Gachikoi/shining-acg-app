package biz

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"app.shiningacg.club/gen/proto/api/common/v1"
	"app.shiningacg.club/pkg/ffmpeg"
	"app.shiningacg.club/pkg/pathutil"
	"app.shiningacg.club/pkg/s3"
	"github.com/bwmarrin/snowflake"
)

// MediaStatus 媒体状态枚举
const (
	MediaStatusProcessing = 0 // 处理中
	MediaStatusCompleted  = 1 // 已完成
	MediaStatusBlocked    = 2 // 违规屏蔽
	MediaStatusFailed     = 4 // 处理失败
)

// StorageType 存储类型枚举
//const (
//	StorageTypeMinIO = "minio"
//)

// ResourceRepo 资源存储库接口
type ResourceRepo interface {
	Save(ctx context.Context, media *commonv1.Media) error
	FindByID(ctx context.Context, id int64) (*commonv1.Media, error)
	UpdateStatus(ctx context.Context, id int64, status int32) error
	UpdateObjectKey(ctx context.Context, id int64, objectKey string) error
	UpdateMeta(ctx context.Context, id int64, meta *commonv1.MediaMeta) error
}

// ResourceUseCase 资源用例
type ResourceUseCase struct {
	repo ResourceRepo
	s3   *s3.Client
	node *snowflake.Node
	pool *ffmpeg.WorkerPool
}

// NewResourceUseCase 创建资源用例实例
func NewResourceUseCase(repo ResourceRepo, s3 *s3.Client, node *snowflake.Node, pool *ffmpeg.WorkerPool) *ResourceUseCase {
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

	// 确定存储路径
	var category string
	switch scene {
	case commonv1.ResourceScene_SCENE_USER_AVATAR:
		category = pathutil.TypeImageAvatar
	case commonv1.ResourceScene_SCENE_POST_IMAGE:
		category = pathutil.TypeImageCommon
	case commonv1.ResourceScene_SCENE_COMMENT_IMAGE:
		category = pathutil.TypeImageCommon
	case commonv1.ResourceScene_SCENE_POST_VIDEO:
		category = pathutil.TypeVideoRaw
	}

	objectKey := pathutil.GenerateObjectKey(mediaID, category, task.Filename)

	// 生成预签名 URL
	expire := time.Hour * 24 // 24小时过期
	uploadURL, headers, err := uc.s3.GenPresignedURL(ctx, objectKey, expire)
	if err != nil {
		return nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	// 构造返回结果
	return &commonv1.UploadToken{
		TaskId:          fmt.Sprintf("%d", mediaID),
		UploadUrl:       uploadURL,
		PublicUrl:       uc.s3.GetObjectURL(objectKey),
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
		commonv1.ResourceScene_SCENE_COMMENT_IMAGE:
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
		Bucket:    uc.s3.Bucket, // 使用导出字段
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
		err = uc.processImage(ctx, mediaID, req.ObjectKey, req.Scene)
		if err != nil {
			return nil, fmt.Errorf("failed to process image: %w", err)
		}

		return &commonv1.CompleteUploadResponse{
			ResourceId: mediaID,
			Status:     "COMPLETED",
		}, nil
	} else {
		// 视频处理（异步）
		go func() {
			// 创建新的上下文，确保异步任务能够独立执行
			asyncCtx := context.Background()
			err := uc.processVideo(asyncCtx, mediaID, req.ObjectKey)
			if err != nil {
				fmt.Printf("failed to process video %d: %v\n", mediaID, err)
				// 处理失败时更新状态为失败
				if updateErr := uc.repo.UpdateStatus(asyncCtx, mediaID, int32(MediaStatusFailed)); updateErr != nil {
					fmt.Printf("failed to update video status %d: %v\n", mediaID, updateErr)
				}
			}
		}()

		return &commonv1.CompleteUploadResponse{
			ResourceId: mediaID,
			Status:     "PROCESSING",
		}, nil
	}
}

// processImage 处理图片
func (uc *ResourceUseCase) processImage(ctx context.Context, mediaID int64, objectKey string, scene commonv1.ResourceScene) error {
	// 下载原始文件到本地临时目录
	tempDir := os.TempDir()
	localPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_temp", mediaID))
	err := uc.s3.DownloadFile(ctx, objectKey, localPath)
	if err != nil {
		return fmt.Errorf("failed to download image: %w", err)
	}
	defer os.Remove(localPath)

	// 获取图片元数据
	imgMeta, err := ffmpeg.GetImageMeta(ctx, localPath)
	if err != nil {
		return fmt.Errorf("failed to get image meta: %w", err)
	}

	// 保存图片元数据到数据库
	err = uc.repo.UpdateMeta(ctx, mediaID, &commonv1.MediaMeta{
		Width:    int32(imgMeta.Width),
		Height:   int32(imgMeta.Height),
		Size:     imgMeta.Size,
		MimeType: imgMeta.MimeType,
	})
	if err != nil {
		return fmt.Errorf("failed to update image meta: %w", err)
	}

	// 根据场景确定是否需要处理图片
	switch scene {
	case commonv1.ResourceScene_SCENE_POST_IMAGE:
		// 压缩为 webp 格式
		compressedPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_compressed.webp", mediaID))

		// 使用 WorkerPool 执行图片压缩
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CompressImage(ctx, localPath, compressedPath, 1080, 0)
		})
		if err != nil {
			return fmt.Errorf("failed to submit compression task: %w", err)
		}

		// 等待任务完成
		if err = <-resultChan; err != nil {
			return fmt.Errorf("failed to compress image: %w", err)
		}
		defer os.Remove(compressedPath)

		// 上传处理后的图片
		compressedObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCommon, "image.webp")
		err = uc.s3.UploadFile(ctx, compressedObjectKey, compressedPath, "image/webp")
		if err != nil {
			return fmt.Errorf("failed to upload compressed image: %w", err)
		}

		// 更新为处理后的图片地址
		err = uc.repo.UpdateObjectKey(ctx, mediaID, compressedObjectKey)
		if err != nil {
			return fmt.Errorf("failed to update object key: %w", err)
		}

	case commonv1.ResourceScene_SCENE_COMMENT_IMAGE:
		// 压缩为 webp 格式
		compressedPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_compressed.webp", mediaID))

		// 使用 WorkerPool 执行图片压缩
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CompressImage(ctx, localPath, compressedPath, 800, 0)
		})
		if err != nil {
			return fmt.Errorf("failed to submit compression task: %w", err)
		}

		// 等待任务完成
		if err = <-resultChan; err != nil {
			return fmt.Errorf("failed to compress image: %w", err)
		}
		defer os.Remove(compressedPath)

		// 上传处理后的图片
		compressedObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCommon, "image.webp")
		err = uc.s3.UploadFile(ctx, compressedObjectKey, compressedPath, "image/webp")
		if err != nil {
			return fmt.Errorf("failed to upload compressed image: %w", err)
		}

		// 更新为处理后的图片地址
		err = uc.repo.UpdateObjectKey(ctx, mediaID, compressedObjectKey)
		if err != nil {
			return fmt.Errorf("failed to update object key: %w", err)
		}

	case commonv1.ResourceScene_SCENE_USER_AVATAR:
		// 头像需要压缩成正方形
		compressedPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_compressed.webp", mediaID))

		// 使用 WorkerPool 执行图片压缩
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CompressImage(ctx, localPath, compressedPath, 256, 256)
		})
		if err != nil {
			return fmt.Errorf("failed to submit compression task: %w", err)
		}

		// 等待任务完成
		if err = <-resultChan; err != nil {
			return fmt.Errorf("failed to compress avatar: %w", err)
		}
		defer os.Remove(compressedPath)

		avatarObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageAvatar, "avatar.webp")
		err = uc.s3.UploadFile(ctx, avatarObjectKey, compressedPath, "image/webp")
		if err != nil {
			return fmt.Errorf("failed to upload avatar: %w", err)
		}

		// 更新为处理后的头像地址
		err = uc.repo.UpdateObjectKey(ctx, mediaID, avatarObjectKey)
		if err != nil {
			return fmt.Errorf("failed to update object key: %w", err)
		}
	}

	err = uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusCompleted))
	if err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	return nil
}

// processVideo 处理视频
func (uc *ResourceUseCase) processVideo(ctx context.Context, mediaID int64, objectKey string) error {
	// 下载原始文件到本地临时目录
	tempDir := os.TempDir()
	localPath := filepath.Join(tempDir, fmt.Sprintf("video_%d_temp", mediaID))
	err := uc.s3.DownloadFile(ctx, objectKey, localPath)
	if err != nil {
		err = fmt.Errorf("failed to download video: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}
	defer os.Remove(localPath)

	// 获取视频元数据
	meta, err := ffmpeg.GetMeta(ctx, localPath)
	if err != nil {
		err = fmt.Errorf("failed to get video meta: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}

	// 转码为 HLS (m4s 切片)
	outputDir := filepath.Join(tempDir, fmt.Sprintf("video_%d_output", mediaID))
	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.TranscodeToHLS(ctx, localPath, outputDir, ffmpeg.DefaultConfig())
	})
	if err != nil {
		err = fmt.Errorf("failed to submit transcode task: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}

	if err = <-resultChan; err != nil {
		err = fmt.Errorf("failed to transcode video: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}
	defer os.RemoveAll(outputDir)

	// 生成封面
	coverPath := filepath.Join(tempDir, fmt.Sprintf("video_%d_cover.webp", mediaID))
	resultChan, err = uc.pool.Submit(func() error {
		return ffmpeg.GenerateCover(ctx, localPath, coverPath, "")
	})
	if err != nil {
		err = fmt.Errorf("failed to submit cover generation task: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}

	if err = <-resultChan; err != nil {
		err = fmt.Errorf("failed to generate cover: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}
	defer os.Remove(coverPath)

	// 上传转码后的文件
	vodDir := pathutil.GetVodDirectory(mediaID)
	err = uc.s3.UploadDirectory(ctx, outputDir, vodDir)
	if err != nil {
		err = fmt.Errorf("failed to upload video slices: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}

	// 上传封面
	coverObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCover, "cover.webp")
	err = uc.s3.UploadFile(ctx, coverObjectKey, coverPath, "image/webp")
	if err != nil {
		err = fmt.Errorf("failed to upload cover: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}

	// 更新数据库
	hlsObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeVideoVod, "index.m3u8")
	err = uc.repo.UpdateObjectKey(ctx, mediaID, hlsObjectKey)
	if err != nil {
		err = fmt.Errorf("failed to update object key: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}

	// 保存视频元数据
	err = uc.repo.UpdateMeta(ctx, mediaID, &commonv1.MediaMeta{
		Width:    int32(meta.Width),
		Height:   int32(meta.Height),
		Duration: int32(meta.Duration),
		Size:     meta.Size,
		MimeType: meta.MimeType,
	})
	if err != nil {
		err = fmt.Errorf("failed to update meta: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return err
	}

	err = uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusCompleted))
	if err != nil {
		err = fmt.Errorf("failed to update status: %w", err)
		return err
	}

	return nil
}

// GetUploadStatus 获取上传状态
func (uc *ResourceUseCase) GetUploadStatus(ctx context.Context, taskID string) (*commonv1.GetUploadStatusResponse, error) {
	// 解析媒体 ID
	mediaID, err := parseTaskID(taskID)
	if err != nil {
		return nil, fmt.Errorf("invalid task_id: %w", err)
	}

	// 查找媒体记录
	media, err := uc.repo.FindByID(ctx, mediaID)
	if err != nil {
		return nil, fmt.Errorf("failed to find media: %w", err)
	}

	// 转换状态
	var status commonv1.MediaStatus
	switch media.Status {
	case MediaStatusProcessing:
		status = commonv1.MediaStatus_MEDIA_STATUS_PROCESSING
	case MediaStatusCompleted:
		status = commonv1.MediaStatus_MEDIA_STATUS_COMPLETED
	case MediaStatusBlocked:
		status = commonv1.MediaStatus_MEDIA_STATUS_BLOCKED
	case MediaStatusFailed:
		status = commonv1.MediaStatus_MEDIA_STATUS_FAILED
	default:
		status = commonv1.MediaStatus_MEDIA_STATUS_UNSPECIFIED
	}

	// 生成公开访问 URL (处理后的图片地址)
	publicURL := uc.s3.GetObjectURL(media.ObjectKey)

	// 构造响应
	return &commonv1.GetUploadStatusResponse{
		Status:    status,
		PublicUrl: publicURL,
		Meta:      media.Meta,
	}, nil
}

func parseTaskID(taskID string) (int64, error) {
	var id int64
	_, err := fmt.Sscanf(taskID, "%d", &id)
	if err != nil {
		return 0, fmt.Errorf("invalid task_id format: %w", err)
	}
	return id, nil
}
