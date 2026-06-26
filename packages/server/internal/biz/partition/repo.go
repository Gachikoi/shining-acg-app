package partition

import (
	"context"
	"errors"
	"sort"
	"strconv"

	partitionv1 "app.shiningacg.club/gen/proto/api/main/partition/v1"
	"app.shiningacg.club/internal/model"
	"gorm.io/gorm"
)

// PartitionList 一组分区，用于repo层使用，临时结构体
type PartitionList struct {
	Partitions []*model.Partition // 分区列表
}

// PartitionRepo 分区仓库接口
// 定义分区相关的数据库操作方法
type PartitionRepo interface {
	Create(ctx context.Context, partition *PartitionList) error

	Get(ctx context.Context, id int32) (*model.Partition, error)

	List(ctx context.Context) (*PartitionList, error)

	Rename(ctx context.Context, id int32, newName string) error

	Delete(ctx context.Context, id int32, moveTo int32) error
}

// PartitionRepoImpl 分区仓库实现
type PartitionRepoImpl struct {
	DB *gorm.DB // 数据库连接
}

// 确保PartitionRepoImpl实现了PartitionRepo接口
var _ PartitionRepo = (*PartitionRepoImpl)(nil)

func NewPartitionRepo(DB *gorm.DB) *PartitionRepoImpl {
	return &PartitionRepoImpl{DB: DB}
}

func (p *PartitionRepoImpl) Create(ctx context.Context, partitions *PartitionList) error {
	if partitions == nil || partitions.Partitions == nil {
		return errors.New("partitions cannot be nil")
	}
	err := p.DB.WithContext(ctx).Create(partitions.Partitions).Error
	return err
}

func (p *PartitionRepoImpl) Get(ctx context.Context, id int32) (*model.Partition, error) {
	var partition model.Partition
	err := p.DB.WithContext(ctx).First(&partition, id).Error
	return &partition, err
}

func (p *PartitionRepoImpl) List(ctx context.Context) (*PartitionList, error) {
	var partitions []*model.Partition
	err := p.DB.WithContext(ctx).Order("sort_order").Find(&partitions).Error

	return &PartitionList{Partitions: partitions}, err
}

func (p *PartitionRepoImpl) Rename(ctx context.Context, id int32, newName string) error {
	var partition model.Partition
	err := p.DB.WithContext(ctx).First(&partition, id).Error
	if err != nil {
		return err
	}
	partition.Name = newName
	return p.DB.Save(&partition).Error
}

func (p *PartitionRepoImpl) Delete(ctx context.Context, id int32, moveTo int32) error {
	if id == moveTo {
		return errors.New("cannot delete partition to itself")
	}

	var targetPartition model.Partition
	if err := p.DB.WithContext(ctx).First(&targetPartition, moveTo).Error; err != nil {
		return errors.New("target partition not found")
	}

	err := p.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Delete(&model.Partition{}, id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("partition not found")
		}

		err := tx.Table("posts").Where("partition_id = ?", id).Update("partition_id", moveTo).Error
		if err != nil {
			return err
		}
		return nil
	})

	return err
}

func NewPartitionList(Names []string) *PartitionList {
	partitions := make([]*model.Partition, 0, len(Names))
	for _, name := range Names {
		partitions = append(partitions, &model.Partition{Name: name})
	}
	return &PartitionList{
		Partitions: partitions,
	}
}

// Sort 按照sortOrder排序
// 功能：对分区列表按排序顺序进行排序
func (p *PartitionList) Sort() {
	if p.Partitions == nil {
		return
	}
	sort.Slice(p.Partitions, func(i, j int) bool {
		return p.Partitions[i].SortOrder < p.Partitions[j].SortOrder
	})
}

// ToPartitions 转换为Service层的对象
// 功能：将数据库模型 PartitionList 转换为服务层的 Partition 列表
// 返回：
//
//	[]*partitionv1.Partition - 服务层分区列表
func (p *PartitionList) ToPartitions() []*partitionv1.Partition {
	s := make([]*partitionv1.Partition, 0, len(p.Partitions))

	for _, part := range p.Partitions {
		s = append(s, &partitionv1.Partition{
			Id:   strconv.Itoa(int(part.ID)),
			Name: part.Name,
		})
	}

	return s
}
