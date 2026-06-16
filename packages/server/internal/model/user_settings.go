package model

import (
	userv1 "app.shiningacg.club/gen/proto/api/main/user/v1"
)

// UserSettings 存储客户端同步的用户偏好配置。
// 以 user_id 为主键，每人一行。
// 对应 proto: api.main.sync.v1.SyncedUserSettings
type UserSettings struct {
	UserID int64 `gorm:"primaryKey;autoIncrement:false" json:"user_id,string"`

	// 通知开关集合，直接复用 proto 生成类型，通过 serializer:json 序列化为 jsonb 存储。
	// proto 字段均携带标准 json tag，encoding/json 可直接处理；
	// 注意 proto bool 字段带 omitempty，false 值不会写入 JSON，读回时默认为 false，语义一致。
	// 对应 proto: SyncedNotificationSettings
	Notification userv1.SyncedNotificationSettings `gorm:"type:jsonb;serializer:json;not null;default:'{}'" json:"notification"`

	// 隐私设置，对应 proto: SyncedPrivacySettings
	PrivacyChat           userv1.ChatPrivacyLevel `gorm:"not null;default:0" json:"privacy_chat"`
	PrivacyLikedPosts     userv1.BasePrivacyLevel `gorm:"not null;default:0" json:"privacy_liked_posts"`
	PrivacyCollectedPosts userv1.BasePrivacyLevel `gorm:"not null;default:0" json:"privacy_collected_posts"`

	// 内容分区排序，存为 jsonb 字符串数组
	// 对应 proto: SyncedContentCategoryOrder.category_ids
	ContentCategoryOrder []string `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"content_category_order"`
}

// 指定表名 防止继续自动加s为复数表面
func (u *UserSettings) TableName() string {
	return "user_settings"
}

func (u *UserSettings) ToSyncedUserSettings() *userv1.SyncedUserSettings {
	return &userv1.SyncedUserSettings{
		Notification: &u.Notification,
		Privacy: &userv1.SyncedPrivacySettings{
			ChatPermission:           u.PrivacyChat,
			LikedPostsVisibility:     u.PrivacyLikedPosts,
			CollectedPostsVisibility: u.PrivacyCollectedPosts,
		},
		ContentCategoryOrder: &userv1.SyncedContentCategoryOrder{
			CategoryIds: u.ContentCategoryOrder,
		},
	}
}
