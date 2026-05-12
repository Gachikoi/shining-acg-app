package model

import (
	"strconv"
	"time"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
)

// BanDuration 封禁时长预设，供业务层设置 BanExpireAt 时使用。
type BanDuration int

const (
	BanDuration1Day    BanDuration = iota // 封禁 1 天
	BanDuration1Week                      // 封禁 1 周
	BanDuration1Month                     // 封禁 1 个月
	BanDurationForever                    // 永久封禁
)

// ExpireAt 将预设时长转换为 BanExpireAt 所需的时间指针。
//
// 返回值语义与 User.BanExpireAt 字段保持一致：
//   - 零值指针（time.Time{}）表示永久封禁
//   - 非零指针表示定期封禁的到期时刻
func (d BanDuration) ExpireAt() *time.Time {
	if d == BanDurationForever {
		t := time.Time{} // 零值作为永久封禁哨兵
		return &t
	}
	now := time.Now()
	var t time.Time
	switch d {
	case BanDuration1Day:
		t = now.Add(24 * time.Hour)
	case BanDuration1Week:
		t = now.Add(7 * 24 * time.Hour)
	case BanDuration1Month:
		t = now.AddDate(0, 1, 0)
	default:
		// 未知时长：返回 nil（调用方不应传入未定义值）
		return nil
	}
	return &t
}

// User 合并账号（QQ 凭证）与用户资料，避免查询 UserBrief 时跨表 JOIN。
// 对应 proto: api.main.user.v1.UserBrief / UserProfile / UserSummary / UserStats
type User struct {
	BaseModel

	// 鉴权字段
	QQUnionID string `gorm:"size:64;uniqueIndex;column:qq_union_id;not null" json:"-"`
	QQNumber  string `gorm:"size:16;uniqueIndex;colunm:qq_number;not null" json:"qq_number"` // 虽然 QQ 号不用作为索引（不直接查询），但加索引可确保唯一性

	// 角色，对应 proto: api.main.common.v1.Role
	Role commonv1.Role `gorm:"not null;default:1" json:"role"`

	// 封禁到期时间，是封禁状态的唯一来源：
	//   nil           → 正常（未封禁）
	//   零值 time.Time → 永久封禁（哨兵值）
	//   未来时间       → 定期封禁，仍在有效期
	//   过去时间       → 定期封禁已到期，视为正常
	BanExpireAt *time.Time `gorm:"index" json:"ban_expire_at,omitempty"`

	// 基本资料（UserBrief 所需字段均在本表）
	Name          string `gorm:"type:text" json:"name"` // 由于初始名称来源于 QQ，所以不做长度较严
	Avatar        string `gorm:"type:text" json:"avatar_url"`
	VerifiedTitle string `gorm:"size:12" json:"verified_title"`

	// 部门徽章 ID 列表，存为 jsonb 数组
	// 对应 proto: UserSummary.departments[].id
	Departments []int64 `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"departments"`

	// 外部链接，结构异构，存为 jsonb 对象数组
	// 对应 proto: UserProfile.links[]
	ExternalLinks []LinkItem `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"external_links"`

	// 最后发帖时间
	LastPostAt time.Time `gorm:"index" json:"last_post_at,omitempty"`

	Settings UserSettings `gorm:"foreignKey:UserID"`

	// 统计缓存（读时免 COUNT，写时业务层维护）
	// 对应 proto: UserStats
	StatFollowers           int64 `gorm:"not null;default:0" json:"stat_followers"`
	StatFollowings          int64 `gorm:"not null;default:0" json:"stat_followings"`
	StatLikesReceived       int64 `gorm:"not null;default:0" json:"stat_likes_received"`
	StatCollectionsReceived int64 `gorm:"not null;default:0" json:"stat_collections_received"`
	StatViewsReceived       int64 `gorm:"not null;default:0" json:"stat_views_received"`
}

// IsBanned 判断用户当前是否处于有效封禁状态（纯计算属性，不访问数据库）。
// 定期封禁已过期时返回 false，无需定时任务批量解封，读取时惰性判断即可。
func (u *User) IsBanned() bool {
	if u.BanExpireAt == nil {
		return false // 未封禁
	}
	if u.BanExpireAt.IsZero() {
		return true // 永久封禁（零值哨兵）
	}
	return time.Now().Before(*u.BanExpireAt) // 定期封禁：是否仍在有效期内
}

// remark可选
func (u *User) ToUserBrief(remark *string) *commonv1.UserBrief {
	if u == nil {
		return nil
	}

	bf := &commonv1.UserBrief{
		UserId:   strconv.FormatInt(u.ID, 10),
		Name:     u.Name,
		Remark:   remark,
		Avatar:   u.Avatar,
		QqNumber: u.QQNumber,
		Role:     u.Role,
	}
	return bf
}

// 转换为UserProfile *remark字段可选
func (u *User) ToProfile(remark *string, departments []*commonv1.DepartmentBase) *commonv1.UserProfile {

	pf := &commonv1.UserProfile{
		UserId:        strconv.FormatInt(u.ID, 10),
		Name:          u.Name,
		Avatar:        u.Avatar,
		Remark:        remark,
		QqNumber:      u.QQNumber,
		Role:          u.Role,
		VerifiedTitle: u.VerifiedTitle,

		Stats: &commonv1.UserStats{
			FollowerCount:        u.StatFollowers,
			FollowingCount:       u.StatFollowings,
			LikeCountReceived:    u.StatLikesReceived,
			CollectCountReceived: u.StatCollectionsReceived,
			ViewCountReceived:    u.StatViewsReceived,
		},

		Departments: departments,
	}

	for _, link := range u.ExternalLinks {
		pf.Links = append(pf.Links, link.ToLink())
	}
	return pf
}
