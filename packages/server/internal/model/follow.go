package model

import "time"

// Follow 记录关注关系，复合主键 (follower_id, following_id) 保证唯一性。
// 取消关注 = 硬删除（无软删除）。
// 对应 proto: api.main.user.v1.SetFollowRequest, FollowingAuthor.has_unread
//
// 索引设计：
//   - idx_follows_by_follower   : 复合索引 (follower_id, created_at, following_id)
//     覆盖 ListUserRelated "我关注的人" 列表的游标分页：
//     WHERE follower_id = ? AND (created_at, following_id) > (cursor_t, cursor_id)
//     ORDER BY created_at ASC, following_id ASC
//     following_id 作为 tiebreaker（同毫秒内多条关注记录时保证游标唯一性）
//   - idx_follows_by_following  : 复合索引 (following_id, created_at, follower_id)
//     覆盖 ListUserRelated "关注我的人（粉丝）" 列表的游标分页：
//     WHERE following_id = ? AND (created_at, follower_id) > (cursor_t, cursor_id)
//     ORDER BY created_at ASC, follower_id ASC
//     follower_id 作为 tiebreaker
//
// 注意：本表无自增 id（复合主键设计），故用另一侧 PK 列作唯一 tiebreaker，
// 两个索引均能保证 keyset 游标不跳行、不重复。
type Follow struct {
	// 作为 idx_follows_by_follower 首列（查我的关注列表）
	// 同时作为 idx_follows_by_following 末列（tiebreaker）
	FollowerID int64 `gorm:"primaryKey;autoIncrement:false;
		index:idx_follows_by_follower,priority:1;
		index:idx_follows_by_following,priority:3" json:"follower_id,string"`
	// 作为 idx_follows_by_following 首列（查我的粉丝列表）
	// 同时作为 idx_follows_by_follower 末列（tiebreaker）
	FollowingID int64 `gorm:"primaryKey;autoIncrement:false;
		index:idx_follows_by_following,priority:1;
		index:idx_follows_by_follower,priority:3" json:"following_id,string"`
	// 用于计算 FollowingAuthor.has_unread：关注者最后阅读该作者动态的时间
	LastReadAt *time.Time `json:"last_read_at"`
	// 作为两个复合索引的排序中间列（priority:2）
	// 原独立索引已合并进复合索引，无需保留单列索引
	CreatedAt time.Time `gorm:"
		index:idx_follows_by_follower,priority:2;
		index:idx_follows_by_following,priority:2" json:"created_at"`
}
