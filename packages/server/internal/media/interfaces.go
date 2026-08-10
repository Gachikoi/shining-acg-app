package media

import (
	"context"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/model"
)

// ScenePolicy 定义不同业务场景的处理策略。
type ScenePolicy struct {
	ImageQuality int
	MaxWidth     int
	MaxHeight    int
	ThumbWidth   int
	ThumbHeight  int
	CropWidth    int
	CropHeight   int
	NeedSquare   bool
}

// Publisher 发布消息到实时通道。
type Publisher interface {
	Publish(channel string, payload any) error
}

// Repo 定义媒体持久化接口。
// 实现位于 internal/media/repo（*repo.Repo），通过 Wire 注入。
type Repo interface {
	CreateAssetWithFiles(ctx context.Context, asset *model.MediaAsset, files []*model.MediaFile) error
	// FindFileByTaskID 仅加载文件记录，不含关联 asset。
	FindFileByTaskID(ctx context.Context, taskID string) (*model.MediaFile, error)
	// FindFileWithAssetByTaskID 通过 Joins("Asset") 在单条 SQL 内同时加载文件与其所属 asset，
	FindFileWithAssetByTaskID(ctx context.Context, taskID string) (*model.MediaFile, error)
	ListMediaAssetsByBatchID(ctx context.Context, batchID string) ([]*mediav1.MediaAsset, error)
	UpdateFileStatus(ctx context.Context, id int64, status int32, errMsg string) error
	UpdateAssetStatus(ctx context.Context, assetID int64, status int32, errMsg string) error
	UpdateFileStatusByTaskID(ctx context.Context, taskID string, status int32, errMsg string) error
	FinalizeFileProcessing(ctx context.Context, id int64, objectKey, thumbnailKey string, meta *mediav1.MediaMeta) error
	CountFilesByBatch(ctx context.Context, batchID string) (int64, error)
	CountProcessedFilesByBatch(ctx context.Context, batchID string) (int64, error)
}
