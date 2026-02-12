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

	// 裁剪为指定尺寸封面
	coverPath := filepath.Join(tempDir, fmt.Sprintf("video_%d_cover.webp", mediaID))
	cfg, _ := config.LoadConfig("")
	resultChan, err = uc.pool.Submit(func() error {
		return ffmpeg.CropImage(ctx, coverOriginalPath, coverPath, cfg.Media.Image.Cover.CropWidth, cfg.Media.Image.Cover.CropHeight)
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

	cfg, _ := config.LoadConfig("")
	if cfg.Media.Video.HLS.Enabled {
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

	// 如果 HLS 转码被禁用，直接返回原始文件路径
	return localPath, nil
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
