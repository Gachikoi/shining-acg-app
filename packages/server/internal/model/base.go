package model

import (
	"time"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
	"gorm.io/gorm"
)

// BaseModel 为所有使用 Snowflake ID 的实体提供统一字段。
// ID 由应用层生成（autoIncrement:false），序列化为 JSON 字符串防止 JS 精度丢失。
type BaseModel struct {
	ID        int64          `gorm:"primaryKey;autoIncrement:false" json:"id,string"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// LinkItem 是 User.ExternalLinks 字段的元素类型，存为 jsonb。
// 对应 proto: api.main.common.v1.Link
type LinkItem struct {
	Label string `gorm:"size:12" json:"label"`
	URL   string `gorm:"size:200" json:"url"`
}

func (l *LinkItem) ToLink() *commonv1.Link {
	return &commonv1.Link{
		Label: l.Label,
		Url:   l.URL,
	}
}
