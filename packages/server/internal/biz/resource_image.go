package biz

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"app.shiningacg.club/config"
	"app.shiningacg.club/gen/proto/api/common/v1"
	"app.shiningacg.club/pkg/ffmpeg"
	"app.shiningacg.club/pkg/pathutil"
)

// downloadAndGetImageMeta 下载图片并获取元数据
func (uc *ResourceUseCase) downloadAndGetImageMeta(ctx context.Context, objectKey string, tempDir string, mediaID int64) (string, *ffmpeg.ImageMeta, error) {
	localPath := filepath.Join(tempDir, fmt.Sprintf("image_%d_temp", mediaID))
	err := uc.s3.downloadFile(ctx, objectKey, localPath)
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

	cfg, _ := config.LoadConfig("")
	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.CompressImage(ctx, localPath, compressedPath, cfg.Media.Image.Post.MaxWidth, cfg.Media.Image.Post.MaxHeight)
	})
	if err != nil {
		return fmt.Errorf("failed to submit compression task: %w", err)
	}

	if err = <-resultChan; err != nil {
		return fmt.Errorf("failed to compress image: %w", err)
	}
	defer os.Remove(compressedPath)

	compressedObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCommon, "image.webp")
	err = uc.s3.uploadFile(ctx, compressedObjectKey, compressedPath, "image/webp")
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

	cfg, _ := config.LoadConfig("")
	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.CompressImage(ctx, localPath, compressedPath, cfg.Media.Image.Comment.MaxWidth, cfg.Media.Image.Comment.MaxHeight)
	})
	if err != nil {
		return fmt.Errorf("failed to submit compression task: %w", err)
	}

	if err = <-resultChan; err != nil {
		return fmt.Errorf("failed to compress image: %w", err)
	}
	defer os.Remove(compressedPath)

	compressedObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageCommon, "image.webp")
	err = uc.s3.uploadFile(ctx, compressedObjectKey, compressedPath, "image/webp")
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

	cfg, _ := config.LoadConfig("")
	resultChan, err := uc.pool.Submit(func() error {
		return ffmpeg.CompressImage(ctx, localPath, compressedPath, cfg.Media.Image.Avatar.MaxWidth, cfg.Media.Image.Avatar.MaxHeight)
	})
	if err != nil {
		return fmt.Errorf("failed to submit compression task: %w", err)
	}

	if err = <-resultChan; err != nil {
		return fmt.Errorf("failed to compress avatar: %w", err)
	}
	defer os.Remove(compressedPath)

	avatarObjectKey := pathutil.GenerateObjectKey(mediaID, pathutil.TypeImageAvatar, "avatar.webp")
	err = uc.s3.uploadFile(ctx, avatarObjectKey, compressedPath, "image/webp")
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

	cfg, _ := config.LoadConfig("")
	if cropCover {
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CropImage(ctx, localPath, compressedPath, cfg.Media.Image.Cover.CropWidth, cfg.Media.Image.Cover.CropHeight)
		})
		if err != nil {
			return fmt.Errorf("failed to submit crop task: %w", err)
		}

		if err = <-resultChan; err != nil {
			return fmt.Errorf("failed to crop cover: %w", err)
		}
	} else {
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CompressImage(ctx, localPath, compressedPath, cfg.Media.Image.Cover.MaxWidth, cfg.Media.Image.Cover.MaxHeight)
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
	err := uc.s3.uploadFile(ctx, coverObjectKey, compressedPath, "image/webp")
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
	err = uc.s3.downloadFile(ctx, sourceMedia.ObjectKey, sourceLocalPath)
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

	cfg, _ := config.LoadConfig("")
	if cropCover {
		resultChan, err := uc.pool.Submit(func() error {
			return ffmpeg.CropImage(ctx, sourceLocalPath, destPath, cfg.Media.Image.Cover.CropWidth, cfg.Media.Image.Cover.CropHeight)
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
			return ffmpeg.CompressImage(ctx, sourceLocalPath, destPath, cfg.Media.Image.Cover.MaxWidth, cfg.Media.Image.Cover.MaxHeight)
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
	err = uc.s3.uploadFile(ctx, coverObjectKey, destPath, "image/webp")
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
