package model

import (
	"encoding/json"
	"time"

	"app.shiningacg.club/gen/proto/api/common/v1"
	"gorm.io/gorm"
)

// BaseModel 基础模型
type BaseModel struct {
	ID        int64          `gorm:"primaryKey;autoIncrement:false" json:"id,string"`
	CreatedAt time.Time      `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt time.Time      `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// Media 数据库模型
type Media struct {
	BaseModel
	MediaType   commonv1.MediaType `gorm:"type:integer;not null" json:"type"`
	StorageType string             `gorm:"type:varchar(20);not null;default:'minio'" json:"storage_type"`
	Bucket      string             `gorm:"type:varchar(100);not null" json:"bucket"`
	ObjectKey   string             `gorm:"type:text;not null" json:"object_key"`
	Status      int32              `gorm:"type:integer;not null;default:0" json:"status"`
	Meta        json.RawMessage    `gorm:"type:jsonb;not null;default:'{}'" json:"meta"`
}
