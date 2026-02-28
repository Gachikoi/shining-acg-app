package model

import (
	"time"

	verificationv1 "app.shiningacg.club/gen/proto/api/main/verification/v1"
)

// VerificationApplication 记录用户身份认证申请，以 user_id 为主键（Upsert 覆盖语义）。
// 对应 proto: api.main.verification.v1.VerificationApplication
//
// 索引设计（idx_verification_cursor）：
//   - 复合索引 (created_at, user_id)
//   - 覆盖 ListVerificationsRequest 游标分页：
//     WHERE (created_at, user_id) > (cursor_t, cursor_id)
//     ORDER BY created_at ASC, user_id ASC
//   - 本表以 user_id 为主键（无自增 id），故以 user_id 作为唯一 tiebreaker；
//     每个用户至多一条申请，(created_at, user_id) 全局唯一，游标不会跳行或重复
type VerificationApplication struct {
	// user_id 既是主键也是与 users 表的外键关联
	// 同时作为游标复合索引的 tiebreaker（priority:2）
	UserID int64 `gorm:"primaryKey;autoIncrement:false;
		index:idx_verification_cursor,priority:2" json:"user_id,string"`

	// 认证信息
	Title            string  `gorm:"size:12;not null" json:"title"`
	Description      string  `gorm:"size:200" json:"description"`
	EvidenceAssetIDs []int64 `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"evidence_asset_ids"`

	// 审核结果，对应 proto: VerificationStatus enum
	Status       verificationv1.VerificationStatus `gorm:"not null;default:0;index" json:"status"`
	ReviewerID   *int64                            `json:"reviewer_id,string,omitempty"`
	AdminComment string                            `gorm:"size:200" json:"admin_comment"`

	// CreatedAt 记录申请提交时间，作为游标复合索引排序主列（priority:1）
	// 与 user_id（priority:2）共同构成 (created_at, user_id) 游标索引
	CreatedAt time.Time `gorm:"index:idx_verification_cursor,priority:1" json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
