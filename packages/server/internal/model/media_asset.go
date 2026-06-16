package model

import (
	"strconv"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
)

// MediaAsset 表示业务层"一个媒体数组元素"（图片 / 视频 / Live Photo）。
// 对应 proto: api.media.v1.MediaAsset
//
// 索引设计说明：
//   - idx_media_assets_batch_order : 复合唯一索引 (batch_id, order_index)
//     唯一性：确保同一批次内不存在重复的排列位置（防止写入两个 order_index=0 的 asset）
//     查询性：覆盖 ListMediaAssetsByBatchID（WHERE batch_id = ? ORDER BY order_index asc, id asc），
//     利用索引有序性消除 filesort；batch_id 前缀同时覆盖仅按批次过滤的场景
//
// 注意：batch_id 本身不是全局唯一的——一个批次含多个 asset；
// 因此唯一性约束必须在 (batch_id, order_index) 复合层面表达。
type MediaAsset struct {
	BaseModel

	// batch_id 作为复合唯一索引首列，前缀即可覆盖按批次的全量查询
	// batch_id 本身不唯一：一个批次含多个 asset
	BatchID   string             `gorm:"size:64;not null;uniqueIndex:idx_media_assets_batch_order,priority:1" json:"batch_id"`
	Scene     mediav1.MediaScene `gorm:"not null" json:"scene"`
	MediaType mediav1.MediaType  `gorm:"not null" json:"media_type"`
	// order_index 作为复合唯一索引次列：(batch_id, order_index) 确保同一批次内排列位置不重复，
	// 同时使索引与 ORDER BY order_index asc 对齐，避免 filesort
	OrderIndex int32 `gorm:"not null;default:0;uniqueIndex:idx_media_assets_batch_order,priority:2" json:"order_index"`
	CropCover  bool  `gorm:"not null;default:false" json:"crop_cover"`
	// status 无独立索引：repo 中所有对 status 的操作均为 UPDATE，从不作为单独 WHERE 过滤条件
	Status       mediav1.MediaStatus `gorm:"not null;default:0" json:"status"`
	ErrorMessage string              `gorm:"type:text;not null;default:''" json:"error_message"`

	// Files 是该资产下的全部物理文件（一图一行 / Live Photo 两行）。
	// 虚拟关联（无 DB 级外键约束），通过 GORM Preload 生成：
	//   SELECT * FROM media_files WHERE asset_id IN (...)
	// 命中 idx_media_files_asset_role 前缀（asset_id），消除 N+1。
	// 对应 proto: api.media.v1.MediaAsset.files[]
	Files []MediaFile `gorm:"foreignKey:AssetID;references:ID" json:"files,omitempty"`
}

func (m *MediaAsset) ToMediaAsset() *mediav1.MediaAsset {
	if m == nil {
		return nil
	}
	asset := &mediav1.MediaAsset{
		AssetId:    strconv.FormatInt(m.ID, 10),
		Scene:      m.Scene,
		Type:       m.MediaType,
		OrderIndex: m.OrderIndex,
		Status:     m.Status,
		Content:    &mediav1.MediaAsset_Single{},
	}
	if len(m.Files) > 0 {
		coverImgFile := m.Files[0]
		asset.Content = &mediav1.MediaAsset_Single{
			Single: coverImgFile.ToMediaFile(),
		}
	}
	return asset

}
