package pathutil

import (
	"fmt"
	"path/filepath"
	"time"
)

// 定义资源类型常量
const (
	TypeImageRaw    = "image/raw"
	TypeImageAvatar = "image/avatar"
	TypeImageCommon = "image/common"
	TypeImageCover  = "image/cover"
	TypeVideoRaw    = "video/raw"
	TypeVideoVod    = "video/vod"
)

// GenerateObjectKey 生成 OSS 存储路径
// mediaID: 雪花算法生成的 ID
// category: 上面定义的常量
// originalName: 原始文件名（用于获取后缀）
func GenerateObjectKey(mediaID int64, category string, originalName string) string {
	ext := filepath.Ext(originalName)
	now := time.Now()

	// 对于 VOD，我们返回的是目录路径，内部固定 index.m3u8
	if category == TypeVideoVod {
		return fmt.Sprintf("%s/%d/index.m3u8", category, mediaID)
	}

	// 对于图片，按日期分卷
	switch category {
	case TypeImageCommon:
		return fmt.Sprintf("%s/%s/%d.webp",
			category,
			now.Format("2006/01/02"),
			mediaID,
		)
	case TypeImageCover:
		return fmt.Sprintf("%s/%d.webp", category, mediaID)
	case TypeImageAvatar:
		return fmt.Sprintf("%s/%d.webp", category, mediaID)
	case TypeImageRaw:
		return fmt.Sprintf("%s/%d%s", category, mediaID, ext)
	case TypeVideoRaw:
		return fmt.Sprintf("%s/%d%s", category, mediaID, ext)
	default:
		return fmt.Sprintf("unknown/%d%s", mediaID, ext)
	}
}

// GetVodDirectory 获取视频切片的目录路径
func GetVodDirectory(mediaID int64) string {
	return fmt.Sprintf("%s/%d", TypeVideoVod, mediaID)
}
