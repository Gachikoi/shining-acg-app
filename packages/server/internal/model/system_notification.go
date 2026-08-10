package model

// SystemNotification 暂不在此次产品规划范围内，定义保留供后续迭代参考。
//
//import (
//	"time"
//
//	notificationv1 "app.shiningacg.club/gen/proto/api/main/notification/v1"
//)
//
//// SystemNotification 存储管理员发布的广播公告。
//// 定向通知（举报/认证结果）直接写 notifications 表，不在本表。
//// 对应 proto: api.main.notification.v1.SystemNotification
////
//// 索引设计（idx_system_notifications_cursor）：
////   - 复合索引 (created_at DESC, id DESC)
////   - 覆盖 ListSystemNotificationsRequest 游标分页：
////     WHERE (created_at, id) < (cursor_t, cursor_id) ORDER BY created_at DESC, id DESC
////   - id 作为 tiebreaker：同毫秒内若有多条系统公告（低概率但需防御），
////     游标需 id 保证全局唯一，避免分页跳行或重复
//type SystemNotification struct {
//	BaseModel
//
//	// ID 覆盖 BaseModel.ID，作为游标复合索引的 tiebreaker（sort:desc,priority:2）
//	ID int64 `gorm:"primaryKey;autoIncrement:false;index:idx_system_notifications_cursor,sort:desc,priority:2" json:"id,string"`
//
//	// CreatedAt 覆盖 BaseModel.CreatedAt，作为游标复合索引的排序主列（sort:desc,priority:1）
//	CreatedAt time.Time `gorm:"index:idx_system_notifications_cursor,sort:desc,priority:1" json:"created_at"`
//
//	Title   string `gorm:"size:100" json:"title"`
//	Content string `gorm:"type:text" json:"content"`
//	// 附图资源 ID 列表，存为 jsonb 数组
//	AssetIDs []int64 `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"asset_ids"`
//
//	// 消息类型，对应 proto: SystemNotificationType enum
//	Type notificationv1.SystemNotificationType `gorm:"not null" json:"type"`
//	// 推送范围：0=全员（无 proto enum，应用内部约定）
//	TargetScope int32 `gorm:"not null;default:0" json:"target_scope"`
//	SenderID    int64 `gorm:"not null" json:"sender_id,string"`
//}
