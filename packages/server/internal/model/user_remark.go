package model

// UserRemark 存储一个用户对另一个用户设置的备注名。
// 复合主键 (owner_id, target_id) 天然保证唯一性。
// 对应 proto: api.main.user.v1.ChangeRemarkRequest, UserBrief.remark
type UserRemark struct {
	OwnerID  int64  `gorm:"primaryKey;autoIncrement:false" json:"owner_id,string"`
	TargetID int64  `gorm:"primaryKey;autoIncrement:false" json:"target_id,string"`
	Remark   string `gorm:"size:12;not null" json:"remark"`
}
