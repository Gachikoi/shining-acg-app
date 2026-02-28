package model

import mediav1 "app.shiningacg.club/gen/proto/api/media/v1"

// 文件在媒体元素中的角色。
const (
	FileRoleSingle         = "single"
	FileRoleLivePhotoImage = "live_photo_image"
	FileRoleLivePhotoVideo = "live_photo_video"
)

// MediaFile 表示媒体元素中的单个物理文件。
// 对应 proto: api.media.v1.MediaFile
//
// 索引设计说明：
//   - idx_media_files_task_id        : 全局唯一索引，覆盖 FindFileByTaskID / UpdateFileStatusByTaskID
//   - idx_media_files_asset_role     : 复合唯一索引 (asset_id, role)
//     确保同一 asset 内每种角色只能存在一个文件（防止写入两个 single / live_photo_image）
//     同时作为 ListFilesByAssetID（asset_id = ?）及批量 IN 查询的查找索引（asset_id 前缀匹配）
//   - idx_media_files_batch_status   : 复合索引 (batch_id, status)
//     前缀匹配覆盖 CountFilesByBatch（WHERE batch_id = ?）
//     全条件覆盖 CountProcessedFilesByBatch（WHERE batch_id = ? AND status IN ?），避免全表扫描
//
// 注意：batch_id / asset_id 本身不是全局唯一的——一个批次含多个文件，一个 Live Photo asset 含 2 个文件；
// 因此不能对单列加 uniqueIndex，唯一性约束必须在复合层面表达。
type MediaFile struct {
	BaseModel

	// asset_id 作为复合唯一索引首列：(asset_id, role) 防止同一 asset 出现重复角色的文件
	// asset_id 本身不唯一：Live Photo asset 有 image + video 两行
	AssetID int64 `gorm:"not null;uniqueIndex:idx_media_files_asset_role,priority:1" json:"asset_id,string"`
	// batch_id 作为复合索引首列：(batch_id, status) 前缀可独立服务 CountFilesByBatch
	// batch_id 本身不唯一：一个批次含多个文件
	BatchID string `gorm:"size:64;not null;index:idx_media_files_batch_status,priority:1" json:"batch_id"`
	// task_id 全局唯一索引：每个文件对应唯一的处理任务，覆盖 FindFileByTaskID / UpdateFileStatusByTaskID
	TaskID string `gorm:"size:64;not null;uniqueIndex:idx_media_files_task_id" json:"task_id"`
	// Role 表示文件在元素中的角色：single / live_photo_image / live_photo_video
	// 作为复合唯一索引次列：(asset_id, role) 确保每种角色在同一 asset 内仅存在一个文件
	Role      string            `gorm:"size:32;not null;uniqueIndex:idx_media_files_asset_role,priority:2" json:"role"`
	MediaType mediav1.MediaType `gorm:"not null" json:"media_type"`
	Bucket    string            `gorm:"size:100;not null" json:"bucket"`
	ObjectKey string            `gorm:"type:text;not null" json:"object_key"`
	// status 作为复合索引次列：与 batch_id 组合覆盖 CountProcessedFilesByBatch 的 AND status IN ? 过滤
	Status       mediav1.MediaStatus `gorm:"not null;default:0;index:idx_media_files_batch_status,priority:2" json:"status"`
	ThumbnailKey string              `gorm:"type:text;not null;default:''" json:"thumbnail_key"`
	ErrorMessage string              `gorm:"type:text;not null;default:''" json:"error_message"`
	OriginalMime string              `gorm:"size:255;not null;default:''" json:"original_mime"`
	// ProcessedMeta 存储处理后的媒体元信息，GORM 自动 JSON 序列化为 jsonb。
	// 对应 proto: api.media.v1.MediaMeta
	ProcessedMeta *mediav1.MediaMeta `gorm:"type:jsonb;serializer:json" json:"processed_meta"`
}
