package model

import (
	"time"

	commentv1 "app.shiningacg.club/gen/proto/api/main/comment/v1"
)

// Comment 统一存储帖子评论（一级）与回复（二级）。
//
// 层级通过 parent_id 是否为 NULL 区分（target_id 两级均存储）：
//
//	一级评论（对帖子的直接评论）：target_id = 帖子ID，parent_id = NULL
//	二级回复（对评论的回复）：    target_id = 帖子ID，parent_id = 一级评论ID
//
// 查询规则：
//
//	查一级：WHERE target_id = ? AND parent_id IS NULL ORDER BY sort_col
//	查二级：WHERE parent_id = ?（不需要指定 target_id）
//
// 索引设计（共 2 个复合索引，均以 id 作为 tiebreaker）：
//
//	idx_comment_target_time → (target_id, parent_id, created_at, id)
//	  覆盖 ListPostComments 按时间排序（LATEST/EARLIEST）：
//	  WHERE target_id = ? AND parent_id IS NULL ORDER BY created_at [ASC|DESC], id [ASC|DESC]
//	  parent_id 作为第 2 列，parent_id IS NULL 过滤直接命中索引，不扫描二级回复行
//
//	idx_comment_parent_time → (parent_id, created_at, id)
//	  覆盖 ListCommentReplies 按时间排序（默认且唯一合理的回复排序）：
//	  WHERE parent_id = ? ORDER BY created_at ASC, id ASC
//
// 按点赞数/回复数排序（MOST/LEAST_LIKED、MOST/LEAST_REPLIES）不建独立索引：
//
//	对应排序在产品中不实际启用，保留 proto 枚举值仅供未来扩展；
//	如需启用，按需补充 (target_id, parent_id, stat_like, id) 等索引即可。
//
// 对应 proto: api.main.comment.v1.Comment / ReplyContext / CreateCommentRequest
type Comment struct {
	BaseModel

	// ID 覆盖 BaseModel.ID，作为两个时间游标索引的最右 tiebreaker。
	// created_at 毫秒精度下可能重复，追加 id 使游标 (created_at, id) 全局唯一。
	ID int64 `gorm:"primaryKey;autoIncrement:false;
		index:idx_comment_target_time,priority:4;
		index:idx_comment_parent_time,priority:3" json:"id,string"`

	// CreatedAt 覆盖 BaseModel.CreatedAt 以附加复合索引 tag。
	// 作为 idx_comment_target_time（priority:3）和 idx_comment_parent_time（priority:2）的排序列。
	CreatedAt time.Time `gorm:"not null;default:now();
		index:idx_comment_target_time,priority:3;
		index:idx_comment_parent_time,priority:2" json:"created_at"`

	// TargetID 一级与二级均存储，指向被评论的帖子 ID，不可为空。
	// TargetType 默认 1 = COMMENT_TARGET_TYPE_POST，保留用于未来扩展。
	TargetID   int64                       `gorm:"not null;index:idx_comment_target_time,priority:1" json:"target_id,string"`
	TargetType commentv1.CommentTargetType `gorm:"not null;default:1" json:"target_type"`

	// ParentID 仅二级回复有值，指向所属一级评论 ID；一级评论为 NULL。
	// 作为 idx_comment_target_time 第 2 列（priority:2），确保 parent_id IS NULL
	// 的过滤能由索引直接命中，不扫描帖子下的全部二级回复行。
	// 作为 idx_comment_parent_time 第 1 列（priority:1），直接定位某条评论的所有回复。
	ParentID *int64 `gorm:"
		index:idx_comment_target_time,priority:2;
		index:idx_comment_parent_time,priority:1" json:"parent_id,string,omitempty"`

	// 回复上下文（仅二级回复有值，内联冗余以避免额外查询，对应 proto: ReplyContext）
	ReplyToCommentID *int64  `json:"reply_to_comment_id,string,omitempty"`
	ReplyToUserID    *int64  `json:"reply_to_user_id,string,omitempty"`
	ReplyToUserName  *string `json:"reply_to_user_name,omitempty"`

	AuthorID int64 `gorm:"not null" json:"author_id,string"`
	Author   User  `gorm:"foreignKey:AuthorID"`

	// Content 长度由 proto CreateCommentRequest.content max_len:300 约束
	Content  string  `gorm:"size:300;not null" json:"content"`
	AssetIDs []int64 `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"asset_ids"`

	// 统计缓存（对应 proto: CommentStats）
	// StatReply 仅对一级评论有语义。
	// stat_like / stat_reply 当前不参与索引，如需启用按统计量排序，届时补充对应复合索引。
	StatLike  int64 `gorm:"not null;default:0" json:"stat_like"`
	StatReply int64 `gorm:"not null;default:0" json:"stat_reply"`
}
