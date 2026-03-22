package partition

import (
	"context"
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
	// Create 创建一组分区
	// 参数：
	//   ctx - 上下文
	//   partition - 分区列表
	// 返回：
	//   error - 错误信息
	Create(ctx context.Context, partition *PartitionList) error

	// Get 获取指定分区
	// 参数：
	//   ctx - 上下文
	//   id - 分区ID
	// 返回：
	//   *model.Partition - 分区信息
	//   error - 错误信息
	Get(ctx context.Context, id int32) (*model.Partition, error)

	// List 获取所有分区
	// 参数：
	//   ctx - 上下文
	// 返回：
	//   *PartitionList - 分区列表
	//   error - 错误信息
	List(ctx context.Context) (*PartitionList, error)

	// Rename 更新分区名称
	// 参数：
	//   ctx - 上下文
	//   id - 分区ID
	//   newName - 新分区名称
	// 返回：
	//   error - 错误信息
	Rename(ctx context.Context, id int32, newName string) error

	// Delete 删除分区
	// 参数：
	//   ctx - 上下文
	//   id - 分区ID
	// 返回：
	//   error - 错误信息
	Delete(ctx context.Context, id int32) error
}

// PartitionRepoImpl 分区仓库实现
type PartitionRepoImpl struct {
	DB *gorm.DB // 数据库连接
}

// 确保PartitionRepoImpl实现了PartitionRepo接口
var _ PartitionRepo = (*PartitionRepoImpl)(nil)

// NewPartitionRepo 创建分区仓库实例
// 参数：
//
//	DB - 数据库连接
//
// 返回：
//
//	*PartitionRepoImpl - 分区仓库实例
func NewPartitionRepo(DB *gorm.DB) *PartitionRepoImpl {
	return &PartitionRepoImpl{DB: DB}
}

// Create 创建一组分区
// 功能：批量创建分区
// 参数：
//
//	ctx - 上下文
//	partitions - 分区列表
//
// 返回：
//
//	error - 错误信息
func (p *PartitionRepoImpl) Create(ctx context.Context, partitions *PartitionList) error {
	err := p.DB.WithContext(ctx).Create(partitions.Partitions).Error
	return err
}

// Get 获取指定分区
// 功能：根据ID查询分区信息
// 参数：
//
//	ctx - 上下文
//	id - 分区ID
//
// 返回：
//
//	*model.Partition - 分区信息
//	error - 错误信息
func (p *PartitionRepoImpl) Get(ctx context.Context, id int32) (*model.Partition, error) {
	var partition model.Partition
	err := p.DB.WithContext(ctx).First(&partition, id).Error
	return &partition, err
}

// List 获取所有分区
// 功能：查询所有分区并按排序顺序返回
// 参数：
//
//	ctx - 上下文
//
// 返回：
//
//	*PartitionList - 分区列表
//	error - 错误信息
func (p *PartitionRepoImpl) List(ctx context.Context) (*PartitionList, error) {
	var partitions []*model.Partition
	err := p.DB.WithContext(ctx).Find(&partitions).Error

	// 按sortOrder排序
	partList := &PartitionList{Partitions: partitions}
	partList.Sort()

	return partList, err
}

// Rename 更新分区名称
// 功能：更新指定分区的名称
// 参数：
//
//	ctx - 上下文
//	id - 分区ID
//	newName - 新分区名称
//
// 返回：
//
//	error - 错误信息
func (p *PartitionRepoImpl) Rename(ctx context.Context, id int32, newName string) error {
	var partition model.Partition
	err := p.DB.WithContext(ctx).First(&partition, id).Error
	if err != nil {
		return err
	}
	partition.Name = newName
	return p.DB.Save(&partition).Error
}

// Delete 删除分区
// 功能：根据ID删除分区
// 参数：
//
//	ctx - 上下文
//	id - 分区ID
//
// 返回：
//
//	error - 错误信息
func (p *PartitionRepoImpl) Delete(ctx context.Context, id int32) error {
	return p.DB.WithContext(ctx).Delete(&model.Partition{}, id).Error
}

// NewPartitionList 按名字创建一组新的Partition
// 功能：根据名称列表创建分区列表
// 参数：
//
//	Names - 分区名称列表
//
// 返回：
//
//	*PartitionList - 分区列表
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
