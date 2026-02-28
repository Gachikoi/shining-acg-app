package model

import (
	"time"

	notificationv1 "app.shiningacg.club/gen/proto/api/main/notification/v1"
)

// NotificationExtra 覆盖全部 category 下可能出现的补充字段（omitempty 省略空值）。
// category=1（评论/提及）: PostCoverURL, CommentID, CommentContent, TargetCommentContent
// category=2（赞/收藏）: PostCoverURL, CommentID, CommentContent, TargetCommentContent
// category=3（关注）: 无额外字段（actor 信息实时查 users 表）
// category=4（系统）: ReportTargetType|TargetSummary|Reason 或 VerifiedTitle|Reason
type NotificationExtra struct {
	// Category 1 & 2
	PostCoverURL         string `json:"post_cover_url,omitempty"`
	CommentID            string `json:"comment_id,omitempty"`
	CommentContent       string `json:"comment_content,omitempty"`
	TargetCommentContent string `json:"target_comment_content,omitempty"`
	// Category 4 – 举报结果（对应 proto: ReportNotificationDetail）
	ReportTargetType notificationv1.ReportTargetType `json:"report_target_type,omitempty"`
	TargetSummary    string                          `json:"target_summary,omitempty"`
	// Category 4 – 举报/认证共用
	Reason string `json:"reason,omitempty"`
	// Category 4 – 认证结果（对应 proto: VerificationNotificationDetail）
	VerifiedTitle string `json:"verified_title,omitempty"`
}

// Notification 存储用户收到的各类通知（评论、点赞、关注、系统/举报/认证）。
// 对应 proto: api.main.notification.v1.*Notification / NotificationStats
//
// 索引说明（idx_notifications_user_feed）：
//   - 列顺序：user_id → category → created_at DESC → id DESC
//   - 覆盖场景：瀑布流拉取全部通知（WHERE user_id = ?）/ 按类别过滤（AND category = ?），
//     两者均以 (created_at DESC, id DESC) 双列游标分页；user_id 作为最左前缀，也覆盖单列 user_id 查询
//   - id 作为最右 tiebreaker：created_at 精度为毫秒，同一毫秒内多条通知时游标需 id 保证唯一性，
//     防止 keyset 分页跳行或重复
//   - is_read 不纳入索引：瀑布流一次性拉取所有类型通知，未读标记由前端/应用层区分；
//     若未来需要"未读计数"等单独查询，可补充 WHERE is_read = false 的局部索引
//   - 通过 GORM tag 声明，作为 schema 的单一事实来源；
//     生产环境须通过版本化迁移工具（如 goose/atlas）执行对应 DDL，而非依赖 AutoMigrate
type Notification struct {
	BaseModel

	// ID 覆盖 BaseModel.ID，作为 idx_notifications_user_feed 的最右 tiebreaker（priority:4, sort:desc）。
	// created_at 在毫秒精度下可能重复，追加 id DESC 使游标 (created_at, id) 全局唯一。
	ID int64 `gorm:"primaryKey;autoIncrement:false;
		index:idx_notifications_user_feed,sort:desc,priority:4" json:"id,string"`

	// 覆盖 BaseModel.CreatedAt 以加入复合索引
	// priority:3 — sort:desc 对应瀑布流游标分页（最新在前），id 在 priority:4 位提供 tiebreaker
	CreatedAt time.Time `gorm:"index:idx_notifications_user_feed,sort:desc,priority:3" json:"created_at"`

	// priority:1 — 复合索引最左列，所有查询的等值过滤条件
	UserID int64 `gorm:"not null;index:idx_notifications_user_feed,priority:1;index:idx_notifications_category_unread" json:"user_id,string"`

	// 通知大类，对应 proto: notificationv1.NotificationCategory
	// priority:2 — 支持按类别过滤（评论/点赞/关注/系统），可选等值条件
	Category notificationv1.NotificationCategory `gorm:"not null;index:idx_notifications_user_feed,priority:2;index:idx_notifications_category_unread" json:"category"`

	// 通知小类，含义依 category 而定：
	// category=1 → CommentMentionType，category=2 → LikeCollectType，category=4 → SystemNotificationType
	// 无法用单一 proto enum 类型表达，统一存储为 int32
	SubType int32 `gorm:"not null" json:"sub_type"`

	// 触发者（系统类通知为 null）
	ActorID *int64 `json:"actor_id,string,omitempty"`

	// 关联目标（部分类别为 null）；1=Post, 2=Comment（应用内部约定）
	TargetType int32  `json:"target_type"`
	TargetID   *int64 `json:"target_id,string,omitempty"`

	// 补充上下文，GORM 自动 JSON 序列化为 jsonb
	Extra *NotificationExtra `gorm:"type:jsonb;serializer:json" json:"extra"`

	// 对应 proto: MarkNotificationReadRequest；不参与复合索引（见结构体注释）
	IsRead bool `gorm:"not null;default:false;index:idx_notifications_category_unread,where:is_read = false" json:"is_read"`
}
