package repo

import (
	"context"
	"encoding/json"
	"fmt"

	"app.shiningacg.club/gen/proto/api/common/v1"
	"app.shiningacg.club/internal/model"
	"gorm.io/gorm"
)

// ResourceRepo 资源存储库接口
type ResourceRepo interface {
	Save(ctx context.Context, media *commonv1.Media) error
	FindByID(ctx context.Context, id int64) (*commonv1.Media, error)
	UpdateStatus(ctx context.Context, id int64, status int32) error
	UpdateObjectKey(ctx context.Context, id int64, objectKey string) error
	UpdateMeta(ctx context.Context, id int64, meta *commonv1.MediaMeta) error
}

// ResourceRepoImpl 资源存储库实现
type ResourceRepoImpl struct {
	db *gorm.DB
}

// NewResourceRepo 创建资源存储库实例
func NewResourceRepo(db *gorm.DB) *ResourceRepoImpl {
	return &ResourceRepoImpl{
		db: db,
	}
}

// Save 保存媒体资源
func (r *ResourceRepoImpl) Save(ctx context.Context, media *commonv1.Media) error {
	var m model.Media
	id, err := parseID(media.Id)
	if err != nil {
		return err
	}

	m.ID = id
	m.MediaType = media.Type
	m.Bucket = media.Bucket
	m.ObjectKey = media.ObjectKey
	m.Status = media.Status

	if media.Meta != nil {
		metaData, err := json.Marshal(media.Meta)
		if err != nil {
			return err
		}
		m.Meta = metaData
	}

	result := r.db.WithContext(ctx).Create(&m)
	return result.Error
}

// FindByID 根据 ID 查询媒体资源
func (r *ResourceRepoImpl) FindByID(ctx context.Context, id int64) (*commonv1.Media, error) {
	var m model.Media
	result := r.db.WithContext(ctx).First(&m, id)
	if result.Error != nil {
		return nil, result.Error
	}

	var meta *commonv1.MediaMeta
	if m.Meta != nil {
		meta = &commonv1.MediaMeta{}
		err := json.Unmarshal(m.Meta, meta)
		if err != nil {
			return nil, err
		}
	}

	return &commonv1.Media{
		Id:        fmt.Sprintf("%d", m.ID),
		Type:      m.MediaType,
		Bucket:    m.Bucket,
		ObjectKey: m.ObjectKey,
		Meta:      meta,
		Status:    m.Status,
	}, nil
}

// UpdateStatus 更新状态
func (r *ResourceRepoImpl) UpdateStatus(ctx context.Context, id int64, status int32) error {
	result := r.db.WithContext(ctx).Model(&model.Media{}).
		Where("id = ?", id).
		Update("status", status)
	return result.Error
}

// UpdateObjectKey 更新对象路径
func (r *ResourceRepoImpl) UpdateObjectKey(ctx context.Context, id int64, objectKey string) error {
	result := r.db.WithContext(ctx).Model(&model.Media{}).
		Where("id = ?", id).
		Update("object_key", objectKey)
	return result.Error
}

// UpdateMeta 更新元数据
func (r *ResourceRepoImpl) UpdateMeta(ctx context.Context, id int64, meta *commonv1.MediaMeta) error {
	metaData, err := json.Marshal(meta)
	if err != nil {
		return err
	}

	result := r.db.WithContext(ctx).Model(&model.Media{}).
		Where("id = ?", id).
		Update("meta", metaData)
	return result.Error
}

func parseID(idStr string) (int64, error) {
	var id int64
	_, err := fmt.Sscanf(idStr, "%d", &id)
	if err != nil {
		return 0, err
	}
	return id, nil
}
