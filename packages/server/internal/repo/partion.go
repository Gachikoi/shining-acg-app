package repo

import (
	"context"
	"errors"

	"app.shiningacg.club/internal/model"
	"gorm.io/gorm"
)

// 分区仓库接口
type PartitionRepo interface {
	// 添加一组分区
	Create(ctx context.Context, partition *model.PartitionList) error
	// 获取特定
	Get(ctx context.Context, id string) (*model.Partition, error)
	// 获取所有分区
	List(ctx context.Context) (*model.PartitionList, error)
	// 更新分区名称
	Rename(ctx context.Context, id string, newName string) error
	// 删除分区
	Delete(ctx context.Context, id string) error
}

// 分区仓库实现
type PartitionUseCase struct {
	DB *gorm.DB
}

// 接口实现验证
var _ PartitionRepo = (*PartitionUseCase)(nil)

// 新建实例
func NewPartitionUseCase(DB *gorm.DB) *PartitionUseCase {
	return &PartitionUseCase{DB: DB}
}

// 分区操作实现
// 拦截数据库的报错信息，转换为业务层错误

func (p *PartitionUseCase) Create(ctx context.Context, partitions *model.PartitionList) error {

	if p.DB.Create(partitions).Error != nil {
		return errors.New("failed to create partitions")
	}

	return nil
}

func (p *PartitionUseCase) Get(ctx context.Context, id string) (*model.Partition, error) {
	var partition model.Partition
	err := p.DB.First(&partition, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, errors.New("partition not found")
	} else if err != nil {
		return nil, errors.New("failed to get partition")
	}

	return &partition, nil
}

func (p *PartitionUseCase) List(ctx context.Context) (*model.PartitionList, error) {
	var partitions []*model.Partition
	err := p.DB.Find(&partitions).Error

	if err != nil {
		return nil, errors.New("failed to list partitions")
	}

	return &model.PartitionList{Partitions: partitions}, nil
}

func (p *PartitionUseCase) Rename(ctx context.Context, id string, newName string) error {
	var partition model.Partition
	err := p.DB.First(&partition, id).Error
	if err != nil {
		return err
	}
	partition.Name = newName
	return p.DB.Save(&partition).Error
}

func (p *PartitionUseCase) Delete(ctx context.Context, id string) error {
	return p.DB.Delete(&model.Partition{}, id).Error
}
