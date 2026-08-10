package media

import (
	"context"
	"fmt"
	"strconv"
	"time"

	feedv1 "app.shiningacg.club/gen/proto/api/main/feed/v1"
	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/apperr"
	"app.shiningacg.club/internal/config"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/pkg/ffmpeg"
	"app.shiningacg.club/pkg/s3"
	"github.com/bwmarrin/snowflake"
)

// UseCase 承载媒体控制面与处理编排逻辑。
//
// 设计说明：
// 1) 上传控制面遵循 Uppy multipart 回调契约（prepare/create/sign/list/complete/abort）。
// 2) 文件任务唯一锚点是 task_id，避免前端持有 object_key 等内部状态。
// 3) 批次顺序在 PrepareUploadBatch 固化，后续接口不允许重排。
type UseCase struct {
	repo Repo
	s3   *s3.Client
	node *snowflake.Node
	pool *ffmpeg.WorkerPool
	rt   Publisher
	cfg  *config.Config
}

// NewUseCase 创建媒体用例。
func NewUseCase(repo Repo, s3Client *s3.Client, node *snowflake.Node, pool *ffmpeg.WorkerPool, publisher Publisher, cfg *config.Config) *UseCase {
	return &UseCase{
		repo: repo,
		s3:   s3Client,
		node: node,
		pool: pool,
		rt:   publisher,
		cfg:  cfg,
	}
}

// PrepareUploadBatch 在上传前解析并固化批次顺序。
func (uc *UseCase) PrepareUploadBatch(ctx context.Context, req *mediav1.PrepareUploadBatchRequest) (*mediav1.PrepareUploadBatchResponse, error) {
	batchID := req.GetBatchId()
	existingCount, err := uc.repo.CountFilesByBatch(ctx, batchID)
	if err != nil {
		return nil, fmt.Errorf("检查批次是否存在失败: %w", err)
	}

	arr := []*feedv1.FeedCategory{
		{
			CategoryId:  "1",
			DisplayName: "1",
			ContentType: feedv1.FeedContentType_FEED_CONTENT_TYPE_POST,
			SortOrder:   1,
			IsSystem:    true,
			Icon:        "1",
		},
		{},
		{},
	}
	arr := make([]*feedv1.FeedCategory, 0, 3)

	if existingCount > 0 {
		return nil, apperr.FailedPrecondition("批次 %s 已经准备过了", batchID)
	}

	assets := req.GetAssets()
	preparedAssets := make([]*mediav1.PreparedUploadAsset, 0, len(assets))

	for orderIndex, uploadAsset := range assets {
		assetType, parsedFiles, cropCover, err := parseUploadAsset(uploadAsset)
		if err != nil {
			return nil, apperr.InvalidArgument("%s", err.Error())
		}
		scene := uploadAsset.GetScene()

		assetID := uc.node.Generate().Int64()
		assetIDStr := strconv.FormatInt(assetID, 10)
		asset := &model.MediaAsset{
			BaseModel:  model.BaseModel{ID: assetID},
			BatchID:    batchID,
			Scene:      scene,
			MediaType:  assetType,
			Status:     mediav1.MediaStatus_MEDIA_STATUS_PROCESSING,
			OrderIndex: int32(orderIndex),
			CropCover:  cropCover,
		}

		files := make([]*model.MediaFile, 0, len(parsedFiles))
		preparedTasks := make([]*mediav1.PreparedUploadTask, 0, len(parsedFiles))
		for _, pf := range parsedFiles {
			file, task := uc.buildFileAndTask(pf, assetID, batchID)
			files = append(files, file)
			preparedTasks = append(preparedTasks, task)
		}

		if err := uc.repo.CreateAssetWithFiles(ctx, asset, files); err != nil {
			return nil, fmt.Errorf("创建 media_asset 失败: %w", err)
		}

		preparedAssets = append(preparedAssets, &mediav1.PreparedUploadAsset{
			AssetId: assetIDStr,
			Scene:   scene,
			Type:    assetType,
			Tasks:   preparedTasks,
		})
	}

	return &mediav1.PrepareUploadBatchResponse{Assets: preparedAssets}, nil
}

// CreateMultipartUpload 为单个文件任务创建 multipart 会话。
func (uc *UseCase) CreateMultipartUpload(ctx context.Context, req *mediav1.CreateMultipartUploadRequest) (*mediav1.CreateMultipartUploadResponse, error) {
	taskID := req.GetTaskId()

	file, err := uc.repo.FindFileByTaskID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if file.Status != mediav1.MediaStatus_MEDIA_STATUS_PROCESSING {
		return nil, apperr.FailedPrecondition("文件状态错误：task %s 中的 file %d 处理状态应该为 MediaStatus_MEDIA_STATUS_PROCESSING", taskID, file.ID)
	}

	uploadID, createErr := uc.s3.CreateMultipartUpload(ctx, file.ObjectKey, file.OriginalMime)
	if createErr != nil {
		return nil, fmt.Errorf("创建分片上传失败: %w", createErr)
	}

	return &mediav1.CreateMultipartUploadResponse{
		TaskId:    file.TaskID,
		UploadId:  uploadID,
		ObjectKey: file.ObjectKey,
	}, nil
}

// SignMultipartPart 为单个分片生成预签名 URL。
func (uc *UseCase) SignMultipartPart(ctx context.Context, req *mediav1.SignMultipartPartRequest) (*mediav1.SignMultipartPartResponse, error) {
	uploadID := req.GetUploadId()
	objectKey := req.GetObjectKey()
	partNumber := req.GetPartNumber()
	signedURL, err := uc.s3.PresignUploadPartURL(ctx, objectKey, uploadID, int(partNumber), 2*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("分片签名失败: %w", err)
	}
	return &mediav1.SignMultipartPartResponse{
		UploadUrl:       signedURL,
		RequiredHeaders: map[string]string{},
	}, nil
}

// ListUploadedParts 查询 multipart 会话已上传分片（断点续传恢复使用）。
func (uc *UseCase) ListUploadedParts(ctx context.Context, req *mediav1.ListUploadedPartsRequest) (*mediav1.ListUploadedPartsResponse, error) {
	uploadID := req.GetUploadId()
	objectKey := req.GetObjectKey()
	parts, err := uc.s3.ListUploadedParts(ctx, objectKey, uploadID)
	if err != nil {
		return nil, fmt.Errorf("ListUploadedParts 失败: %w", err)
	}

	result := make([]*mediav1.UploadedPart, 0, len(parts))
	for _, part := range parts {
		result = append(result, &mediav1.UploadedPart{
			PartNumber: int32(part.PartNumber),
			Etag:       part.ETag,
		})
	}
	return &mediav1.ListUploadedPartsResponse{Parts: result}, nil
}

// CompleteMultipartUpload 合并分片并触发媒体处理。
func (uc *UseCase) CompleteMultipartUpload(ctx context.Context, req *mediav1.CompleteMultipartUploadRequest) (*mediav1.CompleteMultipartUploadResponse, error) {
	taskID := req.GetTaskId()
	uploadID := req.GetUploadId()
	objectKey := req.GetObjectKey()

	parts := req.GetParts()
	completeParts := make([]s3.UploadedPart, 0, len(parts))
	for _, part := range parts {
		if part == nil {
			continue
		}
		completeParts = append(completeParts, s3.UploadedPart{
			PartNumber: int(part.GetPartNumber()),
			ETag:       normalizeETag(part.GetEtag()),
		})
	}

	// FindFileWithAssetByTaskID 通过单条 JOIN SQL 同时加载 file 与 file.Asset，
	// 替代原先的 FindFileByTaskID + FindAssetByID 两次往返。
	file, err := uc.repo.FindFileWithAssetByTaskID(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("查询文件（含asset）失败: %w", err)
	}

	if err = uc.s3.CompleteMultipartUpload(ctx, objectKey, uploadID, completeParts); err != nil {
		return nil, fmt.Errorf("CompleteMultipartUpload 失败: %w", err)
	}

	if file.MediaType == mediav1.MediaType_MEDIA_TYPE_IMAGE {
		go uc.processImage(file.TaskID)
	} else {
		go uc.processVideo(file.TaskID)
	}

	return &mediav1.CompleteMultipartUploadResponse{Media: uc.fileToInfo(file, file.Asset)}, nil
}

// AbortMultipartUpload 中止 multipart 会话并将任务置为失败。
func (uc *UseCase) AbortMultipartUpload(ctx context.Context, req *mediav1.AbortMultipartUploadRequest) (*mediav1.AbortMultipartUploadResponse, error) {
	taskID := req.GetTaskId()
	uploadID := req.GetUploadId()
	objectKey := req.GetObjectKey()
	if err := uc.s3.AbortMultipartUpload(ctx, objectKey, uploadID); err != nil {
		return nil, fmt.Errorf("AbortMultipartUpload 失败: %w", err)
	}

	_ = uc.repo.UpdateFileStatusByTaskID(ctx, taskID, int32(mediav1.MediaStatus_MEDIA_STATUS_FAILED), "upload aborted")

	return &mediav1.AbortMultipartUploadResponse{Success: true}, nil
}

// GetBatchMedia 查询批次内媒体元素结果，并按服务端固化顺序返回。
func (uc *UseCase) GetBatchMedia(ctx context.Context, batchID string) (*mediav1.GetBatchMediaResponse, error) {
	mediaAssets, err := uc.repo.ListMediaAssetsByBatchID(ctx, batchID)
	if err != nil {
		return nil, fmt.Errorf("查询 batch_id 为 %s 的媒体结果失败: %w", batchID, err)
	}
	if len(mediaAssets) == 0 {
		return nil, apperr.NotFound("没有找到 batch_id 为 %s 的文件", batchID)
	}

	return &mediav1.GetBatchMediaResponse{MediaAssets: mediaAssets}, nil
}
