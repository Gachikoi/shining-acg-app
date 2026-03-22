package model

// Partition 是帖子的内容分区，由管理员维护，与部门解耦。
// 对应 proto: api.main.partition.v1.Partition, CreatePostRequest.partition_id
// 不包括所有系统分区

// 删除时直接删除行
// 返回按照sortOrder排序
type Partition struct {
	ID        int32  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string `gorm:"size:12;not null" json:"name"`
	SortOrder int32  `gorm:"not null;default:0" json:"sort_order"`
}
