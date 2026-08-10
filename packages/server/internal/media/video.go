package media

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/pkg/ffmpeg"
	"app.shiningacg.club/pkg/filetype"
	"app.shiningacg.club/pkg/logger"
	"app.shiningacg.club/pkg/pathutil"
)

// processVideo 在后台执行视频处理，避免阻塞上传完成接口。
// 失败会写入文件失败状态并更新批次进度；不会向调用方返回错误。
func (uc *UseCase) processVideo(taskID string) {
	ctx := logger.WithTraceID(context.Background(), fmt.Sprintf("媒体任务-%s", taskID))

	job, err := uc.newVideoJob(ctx, taskID)
	if err != nil {
		slog.ErrorContext(ctx, "初始化视频任务失败", "err", err)
		return
	}

	if err := job.Run(); err != nil {
		uc.failFileProcessing(ctx, job.file, err)
		return
	}

	_ = uc.repo.UpdateAssetStatus(ctx, job.file.AssetID, int32(mediav1.MediaStatus_MEDIA_STATUS_COMPLETED), "")
}

// videoProcessingJob 封装单次视频处理任务的上下文和状态。
type videoProcessingJob struct {
	uc    *UseCase
	ctx   context.Context
	file  *model.MediaFile
	asset *model.MediaAsset

	tempDir      string
	rawVideoPath string
	vodOutputDir string

	meta *ffmpeg.VideoMeta

	vodKey string
}

func (uc *UseCase) newVideoJob(ctx context.Context, taskID string) (*videoProcessingJob, error) {
	// FindFileWithAssetByTaskID 通过单条 JOIN SQL 同时加载 file 与 file.Asset，
	// 替代原先的 FindFileByTaskID + FindAssetByID 两次往返。
	file, err := uc.repo.FindFileWithAssetByTaskID(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("根据任务ID查找文件（含asset）失败: %w", err)
	}

	tempDir := os.TempDir()
	return &videoProcessingJob{
		uc:           uc,
		ctx:          ctx,
		file:         file,
		asset:        file.Asset,
		tempDir:      tempDir,
		rawVideoPath: filepath.Join(tempDir, fmt.Sprintf("media_%d_raw_video", file.ID)),
		vodOutputDir: filepath.Join(tempDir, fmt.Sprintf("media_%d_vod", file.ID)),
	}, nil
}

// Run 执行视频处理主流程。
func (job *videoProcessingJob) Run() error {
	defer job.Cleanup()

	if err := job.downloadRawVideo(); err != nil {
		return err
	}
	if err := job.analyzeMetadata(); err != nil {
		return err
	}
	if err := job.transcode(); err != nil {
		return err
	}
	if err := job.finalize(); err != nil {
		return err
	}

	job.reportProgress(100, "视频处理完成")
	return nil
}

func (job *videoProcessingJob) downloadRawVideo() error {
	job.reportProgress(0, "开始处理视频任务")
	if err := job.uc.s3.DownloadFile(job.ctx, job.file.ObjectKey, job.rawVideoPath); err != nil {
		return fmt.Errorf("下载视频失败: %w", err)
	}

	// XSS 防护：根据文件头魔数校验与声明的 MIME 一致，防止伪造类型上传恶意内容
	const maxHeader = 512
	header := make([]byte, maxHeader)
	f, err := os.Open(job.rawVideoPath)
	if err != nil {
		return fmt.Errorf("读取文件头失败: %w", err)
	}
	n, _ := f.Read(header)
	f.Close()
	header = header[:n]
	if err := filetype.ValidateContentType(header, job.file.OriginalMime); err != nil {
		_ = job.uc.s3.RemoveObject(job.ctx, job.file.ObjectKey)
		return fmt.Errorf("文件类型校验失败（与声明的 MIME 不符）: %w", err)
	}
	return nil
}

func (job *videoProcessingJob) analyzeMetadata() error {
	job.reportProgress(10, "视频下载完成，正在解析元数据")
	meta, err := ffmpeg.GetMeta(job.ctx, job.rawVideoPath)
	if err != nil {
		return fmt.Errorf("读取视频元信息失败: %w", err)
	}
	job.meta = meta
	return nil
}

func (job *videoProcessingJob) transcode() error {
	osRemoveAll(job.vodOutputDir)
	if err := os.MkdirAll(job.vodOutputDir, 0755); err != nil {
		return fmt.Errorf("创建转码输出目录失败: %w", err)
	}

	cfg := ffmpeg.DefaultConfig()
	cfg.HLSTime = 4
	cfg.VideoBitrate = "1500k"
	cfg.Height = 1080
	cfg.TotalDurationMs = int64(job.meta.Duration) * 1000

	var lastReportedPercent int32 = 0
	cfg.ProgressCallback = func(info ffmpeg.ProgressInfo) {
		currentPercent := int32(info.Progress)
		if currentPercent < 0 {
			currentPercent = 0
		}
		if currentPercent > 100 {
			currentPercent = 100
		}
		effectivePercent := 10 + int32(float64(currentPercent)*0.65)
		if effectivePercent > lastReportedPercent {
			lastReportedPercent = effectivePercent
			job.reportProgress(effectivePercent, fmt.Sprintf("正在转码: %.1f%%", info.Progress))
		}
	}

	resultCh, err := job.uc.pool.Submit(func() error {
		return ffmpeg.TranscodeToHLS(job.ctx, job.rawVideoPath, job.vodOutputDir, cfg)
	})
	if err != nil {
		return fmt.Errorf("提交转码任务失败: %w", err)
	}
	if err = <-resultCh; err != nil {
		return fmt.Errorf("转码任务失败: %w", err)
	}

	job.reportProgress(75, "转码完成，正在上传切片")
	return nil
}

func (job *videoProcessingJob) finalize() error {
	vodDir := pathutil.GetVodDirectory(job.file.ID)
	if err := job.uc.s3.UploadDirectory(job.ctx, job.vodOutputDir, vodDir); err != nil {
		return fmt.Errorf("上传转码产物失败: %w", err)
	}

	job.vodKey = pathutil.GenerateObjectKey(job.file.ID, pathutil.TypeVideoVod, "index.m3u8")

	metaMsg := &mediav1.MediaMeta{
		Width:      int32(job.meta.Width),
		Height:     int32(job.meta.Height),
		DurationMs: int64(job.meta.Duration) * int64(time.Second/time.Millisecond),
		SizeBytes:  job.meta.Size,
		MimeType:   "application/x-mpegURL",
	}

	if err := job.uc.repo.FinalizeFileProcessing(job.ctx, job.file.ID, job.vodKey, "", metaMsg); err != nil {
		return err
	}

	if err := job.uc.s3.RemoveObject(job.ctx, job.file.ObjectKey); err != nil {
		slog.WarnContext(job.ctx, "清理原始视频文件失败", "key", job.file.ObjectKey, "err", err)
	}

	return nil
}

// Cleanup 清理本地临时文件。
func (job *videoProcessingJob) Cleanup() {
	osRemove(job.rawVideoPath)
	osRemoveAll(job.vodOutputDir)
}

func (job *videoProcessingJob) reportProgress(percent int32, message string) {
	job.uc.publishBatchProgress(job.ctx, job.file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_TRANSCODING, percent, message)
}
