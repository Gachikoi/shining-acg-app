package media

import (
	"context"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/model"
	rtmodel "app.shiningacg.club/internal/realtime/model"
)

func (uc *UseCase) publishBatchProgress(ctx context.Context, batchID string, stage mediav1.ProgressStage, percent int32, message string) {
	if batchID == "" || uc.rt == nil {
		return
	}
	total, _ := uc.repo.CountFilesByBatch(ctx, batchID)
	processed, _ := uc.repo.CountProcessedFilesByBatch(ctx, batchID)

	evt := &mediav1.BatchProgress{
		BatchId:          batchID,
		Stage:            stage,
		ProcessedCount:   int32(processed),
		TotalCount:       int32(total),
		TranscodePercent: percent,
		Message:          message,
	}
	_ = uc.rt.Publish(rtmodel.MediaBatchEventChannel(batchID), evt)

	if total > 0 && processed >= total && stage != mediav1.ProgressStage_PROGRESS_STAGE_FAILED {
		completed := &mediav1.BatchProgress{
			BatchId:          batchID,
			Stage:            mediav1.ProgressStage_PROGRESS_STAGE_COMPLETED,
			ProcessedCount:   int32(processed),
			TotalCount:       int32(total),
			TranscodePercent: 100,
			Message:          "batch completed",
		}
		_ = uc.rt.Publish(rtmodel.MediaBatchEventChannel(batchID), completed)
	}
}

// failFileProcessing 将文件与资产标记为失败，并推送批次进度通知。
func (uc *UseCase) failFileProcessing(ctx context.Context, file *model.MediaFile, err error) {
	_ = uc.repo.UpdateFileStatus(ctx, file.ID, int32(mediav1.MediaStatus_MEDIA_STATUS_FAILED), err.Error())
	_ = uc.repo.UpdateAssetStatus(ctx, file.AssetID, int32(mediav1.MediaStatus_MEDIA_STATUS_FAILED), err.Error())
	uc.publishBatchProgress(ctx, file.BatchID, mediav1.ProgressStage_PROGRESS_STAGE_FAILED, 0, err.Error())
}
