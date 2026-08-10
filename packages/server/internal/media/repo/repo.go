package repo

import (
	"context"
	"fmt"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/media"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/pkg/s3"
	"gorm.io/gorm"
)

// 编译期断言：确保 *Repo 满足 media.Repo 接口。
// 任何接口方法缺失时会在此处报错，同时也让 IDE 可从接口定义直接跳转到实现。
var _ media.Repo = (*Repo)(nil)

// Repo 是 media.Repo 接口的 GORM 实现。
type Repo struct {
	db *gorm.DB
	s3 *s3.Client
}

// NewRepo 创建媒体仓储实现。
func NewRepo(db *gorm.DB, s3Client *s3.Client) *Repo {
	return &Repo{db: db, s3: s3Client}
}

// CreateAssetWithFiles 写入一个媒体元素及其文件记录。
func (r *Repo) CreateAssetWithFiles(ctx context.Context, asset *model.MediaAsset, files []*model.MediaFile) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(asset).Error; err != nil {
			return err
		}
		for _, file := range files {
			if err := tx.Create(file).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// FindFileByTaskID 按 task_id 查询文件记录。
func (r *Repo) FindFileByTaskID(ctx context.Context, taskID string) (*model.MediaFile, error) {
	var m model.MediaFile
	if err := r.db.WithContext(ctx).Where("task_id = ?", taskID).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// FindFileWithAssetByTaskID 通过 db.Joins("Asset") 在单条 SQL 内同时加载文件与其所属 asset。
// 相较于先调用 FindFileByTaskID 再调用 FindAssetByID 的两次往返，此方法将其合并为一次查询，
// 返回值中 file.Asset 已填充，调用方无需再单独查询 asset。
func (r *Repo) FindFileWithAssetByTaskID(ctx context.Context, taskID string) (*model.MediaFile, error) {
	var m model.MediaFile
	if err := r.db.WithContext(ctx).Joins("Asset").Where("media_files.task_id = ?", taskID).First(&m).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

// ListMediaAssetsByBatchID 查询批次内媒体元素并组装为 proto 返回结构（按固化顺序）。
// 通过虚拟外键关联 Preload 一次性拉取所有文件，消除原先手动 IN 查询的两次往返。
// GORM 生成：
//
//	SELECT * FROM media_assets WHERE batch_id = ? ORDER BY order_index ASC, id ASC
//	SELECT * FROM media_files WHERE asset_id IN (...) ORDER BY id ASC
func (r *Repo) ListMediaAssetsByBatchID(ctx context.Context, batchID string) ([]*mediav1.MediaAsset, error) {
	var assetRows []model.MediaAsset
	if err := r.db.WithContext(ctx).
		Preload("Files", func(db *gorm.DB) *gorm.DB {
			// 保持文件顺序稳定，role 判断依赖 id 有序
			return db.Order("id asc")
		}).
		Where("batch_id = ?", batchID).
		Order("order_index asc").
		Order("id asc").
		Find(&assetRows).Error; err != nil {
		return nil, err
	}

	if len(assetRows) == 0 {
		return []*mediav1.MediaAsset{}, nil
	}

	mediaAssets := make([]*mediav1.MediaAsset, 0, len(assetRows))
	for i := range assetRows {
		// asset.Files 已由 Preload 填充，直接将指针切片传入转换函数
		files := make([]*model.MediaFile, 0, len(assetRows[i].Files))
		for j := range assetRows[i].Files {
			files = append(files, &assetRows[i].Files[j])
		}
		converted, err := r.assetToProto(&assetRows[i], files)
		if err != nil {
			return nil, err
		}
		mediaAssets = append(mediaAssets, converted)
	}
	return mediaAssets, nil
}

func (r *Repo) fileToProto(file *model.MediaFile) *mediav1.MediaFile {
	protoFile := &mediav1.MediaFile{
		FileId:    fmt.Sprintf("%d", file.ID),
		Type:      file.MediaType,
		Bucket:    file.Bucket,
		ObjectKey: file.ObjectKey,
		Url:       r.s3.GetObjectURL(file.ObjectKey),
		Status:    file.Status,
		Meta:      file.ProcessedMeta,
	}
	if file.ThumbnailKey != "" {
		thumbnailURL := r.s3.GetObjectURL(file.ThumbnailKey)
		protoFile.ThumbnailUrl = &thumbnailURL
	}
	return protoFile
}

func (r *Repo) assetToProto(asset *model.MediaAsset, files []*model.MediaFile) (*mediav1.MediaAsset, error) {
	if asset == nil {
		return nil, fmt.Errorf("invalid media asset")
	}
	protoAsset := &mediav1.MediaAsset{
		AssetId:    fmt.Sprintf("%d", asset.ID),
		Type:       asset.MediaType,
		Scene:      asset.Scene,
		Status:     asset.Status,
		OrderIndex: asset.OrderIndex,
	}

	switch asset.MediaType {
	case mediav1.MediaType_MEDIA_TYPE_IMAGE, mediav1.MediaType_MEDIA_TYPE_VIDEO:
		single := findFileByRole(files, model.FileRoleSingle)
		if single == nil {
			if len(files) == 1 {
				single = files[0]
			} else {
				return nil, fmt.Errorf("single media asset %d missing single file", asset.ID)
			}
		}
		protoAsset.Content = &mediav1.MediaAsset_Single{Single: r.fileToProto(single)}
	case mediav1.MediaType_MEDIA_TYPE_LIVE_PHOTO:
		imageFile := findFileByRole(files, model.FileRoleLivePhotoImage)
		videoFile := findFileByRole(files, model.FileRoleLivePhotoVideo)
		if imageFile == nil || videoFile == nil {
			return nil, fmt.Errorf("live photo asset %d missing image/video files", asset.ID)
		}
		protoAsset.Content = &mediav1.MediaAsset_LivePhoto{LivePhoto: &mediav1.LivePhotoAsset{
			Image: r.fileToProto(imageFile),
			Video: r.fileToProto(videoFile),
		}}
	default:
		return nil, fmt.Errorf("unsupported asset type %s", asset.MediaType.String())
	}

	return protoAsset, nil
}

func findFileByRole(files []*model.MediaFile, role string) *model.MediaFile {
	for _, f := range files {
		if f.Role == role {
			return f
		}
	}
	return nil
}

// UpdateFileStatus 更新文件处理状态。
func (r *Repo) UpdateFileStatus(ctx context.Context, id int64, status int32, errMsg string) error {
	return r.db.WithContext(ctx).Model(&model.MediaFile{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":        status,
			"error_message": errMsg,
		}).Error
}

// UpdateAssetStatus 更新媒体元素聚合状态。
func (r *Repo) UpdateAssetStatus(ctx context.Context, assetID int64, status int32, errMsg string) error {
	return r.db.WithContext(ctx).Model(&model.MediaAsset{}).
		Where("id = ?", assetID).
		Updates(map[string]interface{}{
			"status":        status,
			"error_message": errMsg,
		}).Error
}

// UpdateFileStatusByTaskID 通过 task_id 更新文件处理状态。
func (r *Repo) UpdateFileStatusByTaskID(ctx context.Context, taskID string, status int32, errMsg string) error {
	return r.db.WithContext(ctx).Model(&model.MediaFile{}).
		Where("task_id = ?", taskID).
		Updates(map[string]interface{}{
			"status":        status,
			"error_message": errMsg,
		}).Error
}

// FinalizeFileProcessing 在事务中写入对象键、元数据，并将状态标记为完成。
func (r *Repo) FinalizeFileProcessing(ctx context.Context, id int64, objectKey, thumbnailKey string, meta *mediav1.MediaMeta) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return tx.Model(&model.MediaFile{}).
			Where("id = ?", id).
			Updates(map[string]interface{}{
				"object_key":     objectKey,
				"thumbnail_key":  thumbnailKey,
				"processed_meta": meta,
				"status":         int32(mediav1.MediaStatus_MEDIA_STATUS_COMPLETED),
				"error_message":  "",
			}).Error
	})
}

// CountFilesByBatch 返回批次总文件数。
func (r *Repo) CountFilesByBatch(ctx context.Context, batchID string) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.MediaFile{}).Where("batch_id = ?", batchID).Count(&n).Error
	return n, err
}

// CountProcessedFilesByBatch 返回批次已终态文件数。
func (r *Repo) CountProcessedFilesByBatch(ctx context.Context, batchID string) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.MediaFile{}).
		Where("batch_id = ? AND status IN ?", batchID, []int32{
			int32(mediav1.MediaStatus_MEDIA_STATUS_COMPLETED),
			int32(mediav1.MediaStatus_MEDIA_STATUS_FAILED),
			int32(mediav1.MediaStatus_MEDIA_STATUS_BLOCKED),
		}).
		Count(&n).Error
	return n, err
}
