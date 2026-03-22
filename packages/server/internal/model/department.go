package model

import (
	"strconv"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
)

// Department 是用户画像中的"身份徽章"参考表，由管理员维护。
// 对应 proto: api.main.common.v1.DepartmentBase, api.main.department.v1.Department
type Department struct {
	ID        int32  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string `gorm:"size:12;not null" json:"name"`
	SortOrder int32  `gorm:"not null;default:0" json:"sort_order"`
}

func (d *Department) ToDepartmentBase() *commonv1.DepartmentBase {
	if d == nil {
		return nil
	}
	return &commonv1.DepartmentBase{
		Id:   strconv.FormatInt(int64(d.ID), 10),
		Name: d.Name,
	}
}
