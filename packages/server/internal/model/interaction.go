package model

import "time"

// InteractionTargetType 表示互动行为的目标对象类型。
type InteractionTargetType int32

const (
	// InteractionTargetPost 目标为帖子。
	InteractionTargetPost InteractionTargetType = 1
	// InteractionTargetComment 目标为评论（一级评论或二级回复均复用此类型，
	// 由业务层通过 Comment.ParentID 区分层级）。
	InteractionTargetComment InteractionTargetType = 2
)

// InteractionActionType 表示互动行为的操作类型。
type InteractionActionType int32

const (
	// InteractionActionLike 点赞行为，适用于 Post / Comment。
	// 取消点赞 = 硬删除对应行（无软删除）。
	InteractionActionLike InteractionActionType = 1

	// InteractionActionCollect 收藏行为，仅适用于 Post。
	// 取消收藏 = 硬删除对应行（无软删除）。
	InteractionActionCollect InteractionActionType = 2

	// InteractionActionView 浏览/观看行为，仅适用于 Post（target_type = InteractionTargetPost）。
	//
	// 用途：驱动「关注」页关注者列表的未读帖子计数排序。
	//   未读帖子数 = COUNT(作者已发布的帖子) − COUNT(该用户对该作者帖子已有 View 记录的帖子)
	//
	// 复合主键天然去重：同一用户对同一帖子无论浏览多少次只保留一条记录（幂等写入）。
	// View 行为只增不删，用于长期记录「已读」状态。
	InteractionActionView InteractionActionType = 3

	// InteractionActionReply 回复行为，适用于 Post 和 Comment：
	//   target_type = InteractionTargetPost    → 用户在该帖子下发表了评论；
	//   target_type = InteractionTargetComment → 用户回复了该评论（二级回复）。
	//
	// 生命周期：与评论绑定，评论被删除（无论软删除还是硬删除）时，
	// 业务层须同步硬删除本表对应行（Interaction 无 deleted_at，不支持软删除）。
	// 因此 Reply 行可能随时消失，不能作为「已读」的唯一判断依据。
	//
	// 用途：与 View 行为共同加速「已读」查询——发表评论时由 Comment 写入逻辑同步 upsert 本记录，
	// 推荐引擎可减少对 Comment 表的 JOIN；但若 Reply 行已被删除，View 行仍可兜底保证已读语义。
	InteractionActionReply InteractionActionType = 4
)

// Interaction 记录用户对帖子或评论的点赞 / 收藏 / 浏览 / 回复行为。
//
// # 复合主键语义
//
//	(user_id, target_id, target_type, action_type) 四列联合唯一，天然防重复、实现幂等写入。
//
// # 各 action 的生命周期
//   - Like / Collect：可撤销，取消时硬删除对应行。
//   - View：只增不删，持久保留「已读」语义，是未读计数的核心依据。
//   - Reply：与对应评论同生命周期；评论被删除时硬删除本行，故不可单独作为「已读」依据，
//     仅作为辅助加速手段（未被删除时可减少对 Comment 表的查询）。
//
// # 关注列表未读计数方案（冷启动阶段）
//
// 以 View 为核心判断「已读」；Reply 未被删除时可与 View 合并，加速统计：
//
//	SELECT author_id,
//	       COUNT(*) AS total_posts,
//	       COUNT(i.target_id) AS read_posts,
//	       COUNT(*) - COUNT(i.target_id) AS unread_posts
//	FROM posts p
//	LEFT JOIN interactions i
//	  ON i.user_id = <当前用户> AND i.target_id = p.id
//	  AND i.target_type = 1 /* Post */
//	  AND i.action_type IN (3 /* View */, 4 /* Reply */)
//	WHERE p.author_id IN (<关注列表>)
//	GROUP BY p.author_id
//	ORDER BY unread_posts DESC;
//
// 对应 proto: SetPostLikeRequest / SetPostCollectRequest / SetCommentLikeRequest / PostRelationStatus
type Interaction struct {
	// priority:1 — 复合主键最左列，所有查询的等值过滤条件
	UserID int64 `gorm:"primaryKey;autoIncrement:false" json:"user_id,string"`
	// 互动目标的主键 ID（帖子 ID 或评论 ID）
	TargetID int64 `gorm:"primaryKey;autoIncrement:false" json:"target_id,string"`
	// 互动目标的对象类型（1=Post, 2=Comment）
	TargetType InteractionTargetType `gorm:"primaryKey;autoIncrement:false" json:"target_type"`
	// 互动行为类型（1=Like, 2=Collect, 3=View, 4=Reply）
	ActionType InteractionActionType `gorm:"primaryKey;autoIncrement:false" json:"action_type"`
	// 行为发生时间；加普通索引以支持按时间范围统计
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}
