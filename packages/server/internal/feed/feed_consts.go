package feed

// 系统内置 Feed 分类常量，建议统一放在 pkg/consts 或 internal/consts 包下，
// 例如：internal/consts/feed.go，以便各层复用并避免循环依赖。
const (
	SystemFeedCategoryGeneral         = "general"
	SystemFeedCategoryUser            = "user"
	SystemFeedCategoryFollowing       = "following"
	SystemFeedCategoryFollowingAuthor = "following_author"
)
