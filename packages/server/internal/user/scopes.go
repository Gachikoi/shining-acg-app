package user

import (
	"context"

	"gorm.io/gorm"
)

func (u *UserRepoImpl) followingBaseQuery(ctx context.Context) *gorm.DB {
	// 构建获取关注列表的基础查询：包含关注记录和被关注用户的基础字段
	return u.DB.WithContext(ctx).
		Table("follows f").
		Joins("JOIN users u ON u.id = f.following_id").
		Select(`
			f.*,
			u.id,
			u.name,
			u.last_post_at
		`)
}

func (u *UserRepoImpl) followerBaseQuery(ctx context.Context) *gorm.DB {
	// 构建获取粉丝列表的基础查询：包含关注记录和粉丝用户的基础字段
	return u.DB.WithContext(ctx).
		Table("follows f").
		Joins("JOIN users u ON u.id = f.follower_id").
		Select(`
			f.*,
			u.id,
			u.name,
			u.last_post_at
		`)
}

func PreloadFollowings(keyword string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		// 根据关键字选择是否带筛选条件的预加载
		if keyword != "" {
			return db.Preload("Following", "name ILIKE ?", "%"+keyword+"%")
		}
		return db.Preload("Following")
	}
}
