package department

import (
	"context"

	"app.shiningacg.club/internal/model"
	"gorm.io/gorm"
)

type DepartmentRepo interface {
	GetDepartment(ctx context.Context, dprtIds []int64) ([]*model.Department, error)
}

type DepartmentRepoImpl struct {
	DB *gorm.DB
}

func (d *DepartmentRepoImpl) GetDepartment(ctx context.Context, dprtIds []int64) ([]*model.Department, error) {
	var dprts []*model.Department

	err := d.DB.WithContext(ctx).Where("id IN ?", dprtIds).
		Find(&dprts).
		Order("sort_order").
		Error

	if err != nil {
		return nil, err
	}
	return dprts, nil
}
