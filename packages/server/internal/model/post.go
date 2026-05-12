package model

import (
	"strconv"
	"time"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
	postv1 "app.shiningacg.club/gen/proto/api/main/post/v1"
	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
)

// Post 是帖子主体，含统计缓存，支持软删除。
// 对应 proto: api.main.post.v1.Post / PostPreview / PostStats / CreatePostRequest
type Post struct {
	BaseModel

	// 覆盖 BaseModel.ID，同时作为三个游标索引的最右列 tiebreaker（priority:最大）。
	// created_at 在毫秒精度下仍可能重复（同一毫秒内多人发帖），
	// 追加 id DESC 使游标 (created_at, id) 全局唯一，保证 keyset 分页不跳行、不重复。
	// where:deleted_at IS NULL 局部条件统一声明在各索引的 priority:1 列上，此处无需重复。
	ID int64 `gorm:"primaryKey;autoIncrement:false;index:idx_posts_cursor,desc,priority:2;index:idx_posts_author_feed,desc,priority:3;index:idx_posts_partition_feed,desc,priority:3" json:"id,string"`

	// 覆盖 BaseModel.CreatedAt，作为三个复合索引的排序中间列（sort:desc）。
	// where:deleted_at IS NULL 只需在每个索引的 priority:1 列上声明一次（见 PartitionID / AuthorID）；
	// idx_posts_cursor 的 priority:1 列就是 CreatedAt 本身，因此在此声明。
	//
	// 三个索引最终列顺序：
	//   idx_posts_cursor:        created_at DESC → id DESC
	//   idx_posts_author_feed:   author_id → created_at DESC → id DESC
	//   idx_posts_partition_feed: partition_id → created_at DESC → id DESC
	CreatedAt time.Time `gorm:"index:idx_posts_cursor,desc,priority:1,where:deleted_at IS NULL;index:idx_posts_author_feed,desc,priority:2;index:idx_posts_partition_feed,desc,priority:2" json:"created_at"`

	// idx_posts_partition_feed 复合局部索引：
	//   列顺序：partition_id → created_at DESC → id DESC
	//   局部条件：WHERE deleted_at IS NULL（在此列声明，作用于整个索引）
	//   覆盖场景：按分区筛选的瀑布流 keyset 游标分页
	//     WHERE partition_id = ? AND (created_at, id) < (:t, :id)
	//     ORDER BY created_at DESC, id DESC
	//   DDL: CREATE INDEX idx_posts_partition_feed
	//          ON posts (partition_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
	PartitionID int32 `gorm:"not null;index:idx_posts_partition_feed,priority:1,where:deleted_at IS NULL" json:"partition_id"`
	Partition   Partition

	// idx_posts_author_feed 复合局部索引：
	//   列顺序：author_id → created_at DESC → id DESC
	//   局部条件：WHERE deleted_at IS NULL（在此列声明，作用于整个索引）
	//   覆盖场景：
	//     1. 个人主页帖子列表：WHERE author_id = ? ORDER BY created_at DESC, id DESC
	//     2. 关注 Feed 瀑布流：WHERE author_id IN (...) ORDER BY created_at DESC, id DESC
	//     3. 关注列表未读帖子计数：COUNT(*) WHERE author_id IN (...)，author_id 前缀覆盖
	//   DDL: CREATE INDEX idx_posts_author_feed
	//          ON posts (author_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
	AuthorID int64 `gorm:"not null;index:idx_posts_author_feed,priority:1,where:deleted_at IS NULL" json:"author_id,string"`
	Author   User  `gorm:"foreignKey:AuthorID"`

	// 内容字段
	Title   string `gorm:"size:20" json:"title"`
	Content string `gorm:"size:10000" json:"content"`
	// 媒体资源 ID 列表，存为 jsonb 数组
	// 对应 proto: CreatePostRequest.media_assets[].asset_id
	AssetIDs     []int64 `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"asset_ids"`
	CoverAssetID *int64  `json:"cover_asset_id,string,omitempty"`
	IsAllVedio   bool    `json:"is_all_vedio"`

	// 统计缓存（业务层维护，避免聚合查询）
	// 对应 proto: PostStats
	StatLikes       int64 `gorm:"not null;default:0" json:"stat_likes"`
	StatCollections int64 `gorm:"not null;default:0" json:"stat_collections"`
	StatComments    int64 `gorm:"not null;default:0" json:"stat_comments"`
	StatViews       int64 `gorm:"not null;default:0" json:"stat_views"`
}

func (p *Post) ToPreview(cover *mediav1.MediaAsset, author *commonv1.UserBrief) *postv1.PostPreview {
	if p == nil {
		return nil
	}
	
	pv := &postv1.PostPreview{
		PostId:       strconv.FormatInt(p.ID, 10),
		DisplayTitle: &p.Title,
		Cover:        cover,
		Author:       author,
		Stats: &postv1.PostStats{
			LikeCount:    p.StatLikes,
			CollectCount: p.StatCollections,
			CommentCount: p.StatComments,
			ViewCount:    p.StatViews,
		},

		IsOnlyVideo: p.IsAllVedio,

		PublishTime: p.CreatedAt.UnixMilli(),
		UpdateTime:  p.UpdatedAt.UnixMilli(),
	}

	return pv
}
