package model

import (
	"strconv"

	partitionv1 "app.shiningacg.club/gen/proto/api/main/partition/v1"
)

// Partition 是帖子的内容分区，由管理员维护，与部门解耦。
// 对应 proto: api.main.partition.v1.Partition, CreatePostRequest.partition_id

// 删除时直接删除行
// 返回按照sortOrder排序
type Partition struct {
	ID        int32  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string `gorm:"size:12;not null" json:"name"`
	SortOrder int32  `gorm:"not null;default:0" json:"sort_order"`
}

// PartitionList 一组分区
// 用于repo层使用
type PartitionList struct {
	Partitions []*Partition
}

// NewPartitionList 按名字创建一组新的分区
func NewPartitionList(Names []string) *PartitionList {
	partitions := make([]*Partition, 0, len(Names))
	for _, name := range Names {
		partitions = append(partitions, &Partition{Name: name})
	}
	return &PartitionList{
		Partitions: partitions,
	}
}

// 转换为Service层的对象
func (p *PartitionList) ToService() []*partitionv1.Partition {
	s := make([]*partitionv1.Partition, 0, len(p.Partitions))

	for _, part := range p.Partitions {
		s = append(s, &partitionv1.Partition{
			Id:   strconv.Itoa(int(part.ID)),
			Name: part.Name,
		})
	}

	return s
}
