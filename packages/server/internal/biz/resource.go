package biz

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"app.shiningacg.club/gen/proto/api/common/v1"
	"app.shiningacg.club/internal/repo"
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

// ResourceUseCase 资源用例
type ResourceUseCase struct {
	repo repo.ResourceRepo
	s3   *s3.Client
	node *snowflake.Node
	pool *ffmpeg.WorkerPool
}

// convertImageToCover 将图片转换为封面格式（辅助方法）
func (uc *ResourceUseCase) convertImageToCover(ctx context.Context, sourceMediaID int64, cropCover bool) (int64, error) {
	// 获取源媒体信息
	sourceMedia, err := uc.repo.FindByID(ctx, sourceMediaID)
	if err != nil {
		return 0, err
	}

	// 验证源媒体状态为已完成
	if sourceMedia.Status != int32(MediaStatusCompleted) {
		return 0, fmt.Errorf("source media is not completed: %d", sourceMedia.Status)
	}

	// 下载源媒体文件
	tempDir := os.TempDir()
	sourceLocalPath := filepath.Join(tempDir, fmt.Sprintf("convert_%d_source.jpg", sourceMediaID))
	err = uc.s3.DownloadFile(ctx, sourceMedia.ObjectKey, sourceLocalPath)
	if err != nil {
		return 0, fmt.Errorf("failed to download source media: %w", err)
	}
	defer os.Remove(sourceLocalPath)

	// 生成新的媒体ID
	coverMediaID := uc.node.Generate().Int64()

	// 保存封面媒体记录
	coverMedia := &commonv1.Media{
		Id:        fmt.Sprintf("%d", coverMediaID),
		Type:      commonv1.MediaType_MEDIA_TYPE_IMAGE,
		Bucket:    sourceMedia.Bucket,
		ObjectKey: "",
		Status:    int32(MediaStatusProcessing),
	}

	err = uc.repo.Save(ctx, coverMedia)
	if err != nil {
		return 0, err
	}

	// 处理封面转换
	destPath := filepath.Join(tempDir, fmt.Sprintf("convert_%d_cover.webp", coverMediaID))

	if cropCover {
		const targetWidth = 600
		const targetHeight = 800
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CropImage(ctx, sourceLocalPath, destPath, targetWidth, targetHeight)
		})
		if err != nil {
			uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusFailed))
			return 0, err
		}

		if err = <-resultChan; err != nil {
			uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusFailed))
			return 0, err
		}
	} else {
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CompressImage(ctx, sourceLocalPath, destPath, 1080, 0)
		})
		if err != nil {
			uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusFailed))
			return 0, err
		}

		if err = <-resultChan; err != nil {
			uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusFailed))
			return 0, err
		}
	}

	// 上传处理后的封面
	coverObjectKey := pathutil.GenerateObjectKey(coverMediaID, pathutil.TypeImageCover, "cover.webp")
	err = uc.s3.UploadFile(ctx, coverObjectKey, destPath, "image/webp")
	if err != nil {
		uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusFailed))
		os.Remove(destPath)
		return 0, err
	}
	defer os.Remove(destPath)

	// 更新封面媒体记录
	err = uc.repo.UpdateObjectKey(ctx, coverMediaID, coverObjectKey)
	if err != nil {
		uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusFailed))
		return 0, err
	}

	// 获取并更新封面元数据
	coverMeta, err := ffmpeg.GetImageMeta(ctx, destPath)
	if err != nil {
		uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusFailed))
		return 0, err
	}

	err = uc.repo.UpdateMeta(ctx, coverMediaID, &commonv1.MediaMeta{
		Width:    int32(coverMeta.Width),
		Height:   int32(coverMeta.Height),
		Size:     coverMeta.Size,
		MimeType: coverMeta.MimeType,
	})
	if err != nil {
		uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusFailed))
		return 0, err
	}

	// 更新状态为已完成
	err = uc.repo.UpdateStatus(ctx, coverMediaID, int32(MediaStatusCompleted))
	if err != nil {
		return 0, err
	}

	return coverMediaID, nil
}

// NewResourceUseCase 创建资源用例实例
func NewResourceUseCase(repo repo.ResourceRepo, s3 *s3.Client, node *snowflake.Node, pool *ffmpeg.WorkerPool) *ResourceUseCase {
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
	case commonv1.ResourceScene_SCENE_POST_COVER:
		category = pathutil.TypeImageCover
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
		// 根据 req.CropCover 字段决定是否裁剪封面
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

// downloadAndGetImageMeta 下载图片并获取元数据
func (uc *ResourceUseCase) downloadAndGetImageMeta(ctx context.Context, objectKey string, tempDir string, mediaID int64) (string, *ffmpeg.ImageMeta, error) {
	localPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_temp", mediaID))
	err := uc.s3.DownloadFile(ctx, objectKey, localPath)
	if err != nil {
		return "", nil, fmt.Errorf("failed to download image: %w", err)
	}

	imgMeta, err := ffmpeg.GetImageMeta(ctx, localPath)
	if err != nil {
		os.Remove(localPath)
		return "", nil, fmt.Errorf("failed to get image meta: %w", err)
	}

	return localPath, imgMeta, nil
}

// updateImageMeta 更新图片元数据
func (uc *ResourceUseCase) updateImageMeta(ctx context.Context, mediaID int64, imgMeta *ffmpeg.ImageMeta) error {
	return uc.repo.UpdateMeta(ctx, mediaID, &commonv1.MediaMeta{
		Width:    int32(imgMeta.Width),
		Height:   int32(imgMeta.Height),
		Size:     imgMeta.Size,
		MimeType: imgMeta.MimeType,
	})
}

// processPostImage 处理帖子图片（压缩）
func (uc *ResourceUseCase) processPostImage(ctx context.Context, mediaID int64, localPath, tempDir string) error {
	compressedPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_compressed.webp", mediaID))

	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.CompressImage(ctx, localPath, compressedPath, 1080, 0)
	})
	if err != nil {
		return fmt.Errorf("failed to submit compression task: %w", err)
	}

	if err = <-resultChan; err != nil {
		return fmt.Errorf("failed to compress image: %w", err)
	}
	defer os.Remove(compressedPath)

	compressedObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCommon, "image.webp")
	err = uc.s3.UploadFile(ctx, compressedObjectKey, compressedPath, "image/webp")
	if err != nil {
		return fmt.Errorf("failed to upload compressed image: %w", err)
	}

	err = uc.repo.UpdateObjectKey(ctx, mediaID, compressedObjectKey)
	if err != nil {
		return fmt.Errorf("failed to update object key: %w", err)
	}

	return nil
}

// processCommentImage 处理评论图片（压缩）
func (uc *ResourceUseCase) processCommentImage(ctx context.Context, mediaID int64, localPath, tempDir string) error {
	compressedPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_compressed.webp", mediaID))

	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.CompressImage(ctx, localPath, compressedPath, 800, 0)
	})
	if err != nil {
		return fmt.Errorf("failed to submit compression task: %w", err)
	}

	if err = <-resultChan; err != nil {
		return fmt.Errorf("failed to compress image: %w", err)
	}
	defer os.Remove(compressedPath)

	compressedObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCommon, "image.webp")
	err = uc.s3.UploadFile(ctx, compressedObjectKey, compressedPath, "image/webp")
	if err != nil {
		return fmt.Errorf("failed to upload compressed image: %w", err)
	}

	err = uc.repo.UpdateObjectKey(ctx, mediaID, compressedObjectKey)
	if err != nil {
		return fmt.Errorf("failed to update object key: %w", err)
	}

	return nil
}

// processUserAvatar 处理用户头像（压缩成正方形）
func (uc *ResourceUseCase) processUserAvatar(ctx context.Context, mediaID int64, localPath, tempDir string) error {
	compressedPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_compressed.webp", mediaID))

	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.CompressImage(ctx, localPath, compressedPath, 256, 256)
	})
	if err != nil {
		return fmt.Errorf("failed to submit compression task: %w", err)
	}

	if err = <-resultChan; err != nil {
		return fmt.Errorf("failed to compress avatar: %w", err)
	}
	defer os.Remove(compressedPath)

	avatarObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageAvatar, "avatar.webp")
	err = uc.s3.UploadFile(ctx, avatarObjectKey, compressedPath, "image/webp")
	if err != nil {
		return fmt.Errorf("failed to upload avatar: %w", err)
	}

	err = uc.repo.UpdateObjectKey(ctx, mediaID, avatarObjectKey)
	if err != nil {
		return fmt.Errorf("failed to update object key: %w", err)
	}

	return nil
}

// processPostCover 处理帖子封面（压缩或裁剪）
func (uc *ResourceUseCase) processPostCover(ctx context.Context, mediaID int64, localPath, tempDir string, cropCover bool) error {
	compressedPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_compressed.webp", mediaID))

	if cropCover {
		const targetWidth = 600
		const targetHeight = 800
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CropImage(ctx, localPath, compressedPath, targetWidth, targetHeight)
		})
		if err != nil {
			return fmt.Errorf("failed to submit crop task: %w", err)
		}

		if err = <-resultChan; err != nil {
			return fmt.Errorf("failed to crop cover: %w", err)
		}
	} else {
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CompressImage(ctx, localPath, compressedPath, 1080, 0)
		})
		if err != nil {
			return fmt.Errorf("failed to submit compression task: %w", err)
		}

		if err = <-resultChan; err != nil {
			return fmt.Errorf("failed to compress cover: %w", err)
		}
	}
	defer os.Remove(compressedPath)

	coverObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCover, "cover.webp")
	err := uc.s3.UploadFile(ctx, coverObjectKey, compressedPath, "image/webp")
	if err != nil {
		return fmt.Errorf("failed to upload cover: %w", err)
	}

	err = uc.repo.UpdateObjectKey(ctx, mediaID, coverObjectKey)
	if err != nil {
		return fmt.Errorf("failed to update object key: %w", err)
	}

	return nil
}

// processImage 处理图片（主入口方法）
func (uc *ResourceUseCase) processImage(ctx context.Context, mediaID int64, objectKey string, scene commonv1.ResourceScene, cropCover bool) error {
	// 创建临时目录
	tempDir := os.TempDir()

	// 下载并获取图片元数据
	localPath, imgMeta, err := uc.downloadAndGetImageMeta(ctx, objectKey, tempDir, mediaID)
	if err != nil {
		return err
	}
	defer os.Remove(localPath)

	// 更新图片元数据
	err = uc.updateImageMeta(ctx, mediaID, imgMeta)
	if err != nil {
		return err
	}

	// 根据场景处理图片
	switch scene {
	case commonv1.ResourceScene_SCENE_POST_IMAGE:
		err = uc.processPostImage(ctx, mediaID, localPath, tempDir)
	case commonv1.ResourceScene_SCENE_COMMENT_IMAGE:
		err = uc.processCommentImage(ctx, mediaID, localPath, tempDir)
	case commonv1.ResourceScene_SCENE_USER_AVATAR:
		err = uc.processUserAvatar(ctx, mediaID, localPath, tempDir)
	case commonv1.ResourceScene_SCENE_POST_COVER:
		err = uc.processPostCover(ctx, mediaID, localPath, tempDir, cropCover)
	default:
		err = fmt.Errorf("unsupported resource scene: %v", scene)
	}

	if err != nil {
		return err
	}

	// 更新状态为已完成
	err = uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusCompleted))
	if err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	return nil
}

// downloadAndGetVideoMeta 下载视频并获取元数据
func (uc *ResourceUseCase) downloadAndGetVideoMeta(ctx context.Context, mediaID int64, objectKey string) (string, *ffmpeg.VideoMeta, error) {
	tempDir := os.TempDir()
	localPath := filepath.Join(tempDir, fmt.Sprintf("video_%d_temp", mediaID))
	err := uc.s3.DownloadFile(ctx, objectKey, localPath)
	if err != nil {
		err = fmt.Errorf("failed to download video: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", nil, err
	}

	meta, err := ffmpeg.GetMeta(ctx, localPath)
	if err != nil {
		err = fmt.Errorf("failed to get video meta: %w", err)
		os.Remove(localPath)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", nil, err
	}

	return localPath, meta, nil
}

// generateAndUploadVideoCover 生成并上传视频封面
func (uc *ResourceUseCase) generateAndUploadVideoCover(ctx context.Context, mediaID int64, localPath string) (string, error) {
	tempDir := os.TempDir()

	// 生成原始封面
	coverOriginalPath := filepath.Join(tempDir, fmt.Sprintf("video_%d_cover_original.jpg", mediaID))
	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.GenerateCoverOriginal(ctx, localPath, coverOriginalPath, "")
	})
	if err != nil {
		err = fmt.Errorf("failed to submit cover generation task: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}

	if err = <-resultChan; err != nil {
		err = fmt.Errorf("failed to generate cover original: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}
	defer os.Remove(coverOriginalPath)

	// 裁剪为 3:4 比例封面
	coverPath := filepath.Join(tempDir, fmt.Sprintf("video_%d_cover.webp", mediaID))
	resultChan, err = uc.pool.Submit(func() error {
		const targetWidth = 600
		const targetHeight = 800
		return ffmpeg.CropImage(ctx, coverOriginalPath, coverPath, targetWidth, targetHeight)
	})
	if err != nil {
		err = fmt.Errorf("failed to submit cover crop task: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}

	if err = <-resultChan; err != nil {
		err = fmt.Errorf("failed to crop cover: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}
	defer os.Remove(coverPath)

	// 上传封面
	coverObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCover, "cover.webp")
	err = uc.s3.UploadFile(ctx, coverObjectKey, coverPath, "image/webp")
	if err != nil {
		err = fmt.Errorf("failed to upload cover: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}

	return coverObjectKey, nil
}

// transcodeVideoToHLS 转码视频为 HLS 格式
func (uc *ResourceUseCase) transcodeVideoToHLS(ctx context.Context, mediaID int64, localPath string) (string, error) {
	tempDir := os.TempDir()
	outputDir := filepath.Join(tempDir, fmt.Sprintf("video_%d_output", mediaID))

	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.TranscodeToHLS(ctx, localPath, outputDir, ffmpeg.DefaultConfig())
	})
	if err != nil {
		err = fmt.Errorf("failed to submit transcode task: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}

	if err = <-resultChan; err != nil {
		err = fmt.Errorf("failed to transcode video: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}
	defer os.RemoveAll(outputDir)

	// 上传转码后的文件
	vodDir := pathutil.GetVodDirectory(mediaID)
	err = uc.s3.UploadDirectory(ctx, outputDir, vodDir)
	if err != nil {
		err = fmt.Errorf("failed to upload video slices: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}

	hlsObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeVideoVod, "index.m3u8")
	err = uc.repo.UpdateObjectKey(ctx, mediaID, hlsObjectKey)
	if err != nil {
		err = fmt.Errorf("failed to update object key: %w", err)
		uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusFailed))
		return "", err
	}

	return hlsObjectKey, nil
}

// updateVideoMeta 更新视频元数据
func (uc *ResourceUseCase) updateVideoMeta(ctx context.Context, mediaID int64, meta *ffmpeg.VideoMeta, coverObjectKey string) error {
	// 获取封面元数据（可用于调试或扩展）
	_, err := uc.getCoverMeta(ctx, mediaID, coverObjectKey)
	if err != nil {
		return fmt.Errorf("failed to get cover meta: %w", err)
	}

	return uc.repo.UpdateMeta(ctx, mediaID, &commonv1.MediaMeta{
		Width:    int32(meta.Width),
		Height:   int32(meta.Height),
		Duration: int32(meta.Duration),
		Size:     meta.Size,
		MimeType: meta.MimeType,
		// 可以考虑在 meta 中存储 cover_id
	})
}

// getCoverMeta 获取封面元数据（辅助方法）
func (uc *ResourceUseCase) getCoverMeta(ctx context.Context, mediaID int64, coverObjectKey string) (*commonv1.MediaMeta, error) {
	// 下载封面文件以获取元数据
	tempDir := os.TempDir()
	coverLocalPath := filepath.Join(tempDir, fmt.Sprintf("video_%d_cover_meta.webp", mediaID))
	err := uc.s3.DownloadFile(ctx, coverObjectKey, coverLocalPath)
	if err != nil {
		return nil, err
	}
	defer os.Remove(coverLocalPath)

	coverMeta, err := ffmpeg.GetImageMeta(ctx, coverLocalPath)
	if err != nil {
		return nil, err
	}

	return &commonv1.MediaMeta{
		Width:    int32(coverMeta.Width),
		Height:   int32(coverMeta.Height),
		Size:     coverMeta.Size,
		MimeType: coverMeta.MimeType,
	}, nil
}

// processVideo 处理视频（主入口方法）
func (uc *ResourceUseCase) processVideo(ctx context.Context, mediaID int64, objectKey string) error {
	// 1. 下载视频并获取元数据
	localPath, meta, err := uc.downloadAndGetVideoMeta(ctx, mediaID, objectKey)
	if err != nil {
		return err
	}
	defer os.Remove(localPath)

	// 2. 生成并上传封面
	coverObjectKey, err := uc.generateAndUploadVideoCover(ctx, mediaID, localPath)
	if err != nil {
		return err
	}

	// 3. 转码视频为 HLS
	_, err = uc.transcodeVideoToHLS(ctx, mediaID, localPath)
	if err != nil {
		return err
	}

	// 4. 更新视频元数据
	err = uc.updateVideoMeta(ctx, mediaID, meta, coverObjectKey)
	if err != nil {
		return err
	}

	// 5. 更新状态为已完成
	err = uc.repo.UpdateStatus(ctx, mediaID, int32(MediaStatusCompleted))
	if err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	return nil
}

// getMediaByID 查找媒体记录并转换状态
func (uc *ResourceUseCase) getMediaByID(ctx context.Context, taskID string) (*commonv1.Media, commonv1.MediaStatus, error) {
	mediaID, err := parseTaskID(taskID)
	if err != nil {
		return nil, commonv1.MediaStatus_MEDIA_STATUS_UNSPECIFIED, fmt.Errorf("invalid task_id: %w", err)
	}

	media, err := uc.repo.FindByID(ctx, mediaID)
	if err != nil {
		return nil, commonv1.MediaStatus_MEDIA_STATUS_UNSPECIFIED, fmt.Errorf("failed to find media: %w", err)
	}

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

	return media, status, nil
}

// buildGetUploadStatusResponse 构造获取上传状态的响应
func (uc *ResourceUseCase) buildGetUploadStatusResponse(media *commonv1.Media, status commonv1.MediaStatus) *commonv1.GetUploadStatusResponse {
	publicURL := uc.s3.GetObjectURL(media.ObjectKey)

	return &commonv1.GetUploadStatusResponse{
		Status:    status,
		PublicUrl: publicURL,
		Meta:      media.Meta,
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

func parseTaskID(taskID string) (int64, error) {
	var id int64
	_, err := fmt.Sscanf(taskID, "%d", &id)
	if err != nil {
		return 0, fmt.Errorf("invalid task_id format: %w", err)
	}
	return id, nil
}
