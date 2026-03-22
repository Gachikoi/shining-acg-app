package model

import (
	"encoding/json"
	"time"

	authv1 "app.shiningacg.club/gen/proto/api/main/auth/v1"
)

// Device 存储已登录设备的鉴权与推送信息。
// 以客户端上报的 device_id（字符串）为主键，与 proto 标识符直接对齐。
// 对应 proto: api.main.auth.v1.DeviceInfo, ActiveDevice, UpdatePushTokenRequest
type Device struct {
	DeviceID string `gorm:"primaryKey;size:128" json:"device_id"`
	UserID   int64  `gorm:"not null;index" json:"user_id,string"`
	User     User

	// 设备信息，对应 proto: DeviceInfo
	Platform      authv1.DevicePlatform `gorm:"not null" json:"platform"`
	DeviceName    string                `gorm:"size:100" json:"device_name"`
	OSVersion     string                `gorm:"size:50" json:"os_version"`
	ClientVersion string                `gorm:"size:50" json:"client_version"`
	PushToken     string                `gorm:"type:text" json:"push_token"`

	// JWT 刷新令牌轮换字段
	// jti 用于 refresh token 撤销，uniqueIndex 防止重放
	RefreshTokenJTI       string     `gorm:"size:64;uniqueIndex" json:"refresh_token_jti"`
	RefreshTokenExpiresAt *time.Time `json:"refresh_token_expires_at"`

	// 客户端同步版本号 map，结构异构，存为 jsonb
	// 对应 proto: SyncStatus.data_versions
	SyncDataVersions json.RawMessage `gorm:"type:jsonb;not null;default:'{}'" json:"sync_data_versions"`

	LastActiveAt time.Time `json:"last_active_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
