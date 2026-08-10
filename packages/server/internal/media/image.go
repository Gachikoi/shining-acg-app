package media

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/pkg/ffmpeg"
	"app.shiningacg.club/pkg/filetype"
	"app.shiningacg.club/pkg/logger"
	"app.shiningacg.club/pkg/pathutil"
)

// processImage 在后台执行图片处理，避免阻塞上传完成接口。
// 失败会写入文件失败状态并更新批次进度；不会向调用方返回错误。
func (uc *UseCase) processImage(taskID string) {
	ctx := logger.WithTraceID(context.Background(), fmt.Sprintf("media-task-%s", taskID))
	// FindFileWithAssetByTaskID 通过 JOIN 在单条 SQL 内同时拿到 file 和 file.Asset，
	// 避免原来 FindFileByTaskID + FindAssetByID 的两次往返。
	file, err := uc.repo.FindFileWithAssetByTaskID(ctx, taskID)
	if err != nil {
		return
	}

	processor := newImageProcessor(uc, ctx, file, file.Asset)
	defer processor.cleanup()

	if err := processor.execute(ctx); err != nil {
		uc.failFileProcessing(ctx, file, err)
		return
	}

	_ = uc.repo.UpdateAssetStatus(ctx, file.AssetID, int32(mediav1.MediaStatus_MEDIA_STATUS_COMPLETED), "")
}

// imageProcessor 封装图片处理流程状态，避免长函数参数传递。
type imageProcessor struct {
	uc    *UseCase
	ctx   context.Context
	file  *model.MediaFile
	asset *model.MediaAsset

	tempDir    string
	rawPath    string
	cropPath   string
	outputPath string
	thumbPath  string

	hasThumbnail     bool
	uploadedThumbKey string
}

func newImageProcessor(uc *UseCase, ctx context.Context, file *model.MediaFile, asset *model.MediaAsset) *imageProcessor {
	p := &imageProcessor{
		uc:      uc,
		ctx:     ctx,
		file:    file,
		asset:   asset,
		tempDir: os.TempDir(),
	}
	p.initPaths()
	return p
}

func (p *imageProcessor) initPaths() {
	p.rawPath = filepath.Join(p.tempDir, fmt.Sprintf("media_%d_raw", p.file.ID))
	p.cropPath = filepath.Join(p.tempDir, fmt.Sprintf("media_%d_crop", p.file.ID))
	p.outputPath = filepath.Join(p.tempDir, fmt.Sprintf("media_%d_output.webp", p.file.ID))
	p.thumbPath = filepath.Join(p.tempDir, fmt.Sprintf("media_%d_thumb.webp", p.file.ID))
}

func (p *imageProcessor) execute(ctx context.Context) error {
	if err := p.prepareAndDownload(); err != nil {
		return err
	}
	if err := p.process(); err != nil {
		return err
	}
	outputKey, err := p.upload()
	if err != nil {
		return err
	}
	return p.finalize(ctx, outputKey)
}

func (p *imageProcessor) prepareAndDownload() error {
	p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 5, "正在下载原图")
	if err := p.uc.s3.DownloadFile(p.ctx, p.file.ObjectKey, p.rawPath); err != nil {
		return fmt.Errorf("下载图片失败: %w", err)
	}
	p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 15, "原图下载完成")

	// XSS 防护：根据文件头魔数校验与声明的 MIME 一致，防止伪造扩展名/MIME 上传恶意内容
	const maxHeader = 512
	header := make([]byte, maxHeader)
	f, err := os.Open(p.rawPath)
	if err != nil {
		return fmt.Errorf("读取文件头失败: %w", err)
	}
	n, _ := f.Read(header)
	f.Close()
	header = header[:n]
	if err := filetype.ValidateContentType(header, p.file.OriginalMime); err != nil {
		_ = p.uc.s3.RemoveObject(p.ctx, p.file.ObjectKey)
		return fmt.Errorf("文件类型校验失败（与声明的 MIME 不符）: %w", err)
	}
	return nil
}

func (p *imageProcessor) cleanup() {
	osRemove(p.rawPath)
	osRemove(p.cropPath)
	osRemove(p.outputPath)
	osRemove(p.thumbPath)
}

func (p *imageProcessor) process() error {
	policy := scenePolicy(p.asset.Scene)
	p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 20, "正在处理图片")

	currentSource := p.rawPath
	if p.asset.CropCover {
		if err := ffmpeg.CropImage(p.ctx, p.rawPath, p.cropPath, policy.CropWidth, policy.CropHeight); err != nil {
			return fmt.Errorf("裁切图像失败: %w", err)
		}
		p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 30, "图片裁切完成")
		currentSource = p.cropPath
	}

	if err := ffmpeg.CompressImage(p.ctx, currentSource, p.outputPath, policy.MaxWidth, policy.MaxHeight); err != nil {
		return fmt.Errorf("压缩图像失败: %w", err)
	}
	p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 50, "图片压缩完成")

	if p.asset.Scene == mediav1.MediaScene_MEDIA_SCENE_POST_COVER {
		if err := ffmpeg.CompressImage(p.ctx, p.outputPath, p.thumbPath, policy.ThumbWidth, policy.ThumbHeight); err != nil {
			return fmt.Errorf("生成缩略图失败: %w", err)
		}
		p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 60, "缩略图生成完成")
		p.hasThumbnail = true
	}
	return nil
}

func (p *imageProcessor) upload() (string, error) {
	p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 65, "正在上传处理结果")

	outputCategory := outputCategoryByScene(p.asset.Scene, p.file.MediaType)
	outputKey := pathutil.GenerateObjectKey(p.file.ID, outputCategory, "output.webp")
	thumbKey := strings.TrimSuffix(outputKey, ".webp") + "_thumb.webp"

	if err := p.uc.s3.UploadFile(p.ctx, outputKey, p.outputPath, "image/webp"); err != nil {
		return "", fmt.Errorf("上传压缩后的图像失败: %w", err)
	}
	p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 85, "主图上传完成")

	if p.hasThumbnail {
		if err := p.uc.s3.UploadFile(p.ctx, thumbKey, p.thumbPath, "image/webp"); err != nil {
			return "", fmt.Errorf("上传缩略图失败: %w", err)
		}
		p.uploadedThumbKey = thumbKey
		p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 95, "缩略图上传完成")
	}

	return outputKey, nil
}

func (p *imageProcessor) finalize(ctx context.Context, outputKey string) error {
	meta, err := ffmpeg.GetImageMeta(p.ctx, p.outputPath)
	if err != nil {
		return fmt.Errorf("读取图像元数据（meta）失败: %w", err)
	}
	metaMsg := &mediav1.MediaMeta{
		Width:      int32(meta.Width),
		Height:     int32(meta.Height),
		DurationMs: 0,
		SizeBytes:  meta.Size,
		MimeType:   "image/webp",
	}

	if err = p.uc.repo.FinalizeFileProcessing(p.ctx, p.file.ID, outputKey, p.uploadedThumbKey, metaMsg); err != nil {
		return err
	}

	if err = p.uc.s3.RemoveObject(p.ctx, p.file.ObjectKey); err != nil {
		slog.WarnContext(ctx, "清理原始图像文件失败", "key", p.file.ObjectKey, "err", err)
	}

	p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 100, "图片处理完成")
	p.uc.publishBatchProgress(p.ctx, p.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_COMPRESSING, 100, "图片处理完成")
	return nil
}
