// Package mediapolicy 统一管理项目内「支持的媒体类型」：MIME 白名单、扩展名白名单、与 proto MediaType 的映射、
// 以及供 buf 校验（CEL）使用的正则。所有“是否允许该 MIME/扩展名”的判断均由此包提供，避免分散在 proto、upload、pathutil、filetype 等处。
package mediapolicy

import (
	"fmt"
	"strings"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
)

// 支持的图片 MIME（小写，用于 map 查找）
var imageMIMEs = []string{
	"image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/webp",
}

// 支持的视频 MIME（小写）
var videoMIMEs = []string{
	"video/mp4", "video/quicktime", "video/x-m4v", "video/webm",
}

// 支持的图片扩展名（小写，含点号）
var imageExts = []string{
	".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
}

// 支持的视频扩展名（小写，含点号）
var videoExts = []string{
	".mp4", ".mov", ".m4v", ".webm",
}

// 声明 MIME -> 魔数检测可能返回的 MIME 列表（供 filetype.ValidateContentType 使用）
var mimeToDetected = map[string][]string{
	"image/jpeg":      {"image/jpeg"},
	"image/jpg":       {"image/jpeg"},
	"image/png":       {"image/png"},
	"image/webp":      {"image/webp"},
	"image/heic":      {"image/heic", "image/heif"},
	"image/heif":      {"image/heic", "image/heif"},
	"video/mp4":       {"video/mp4", "video/quicktime"},
	"video/quicktime": {"video/mp4", "video/quicktime"},
	"video/x-m4v":     {"video/mp4", "video/quicktime"},
	"video/webm":      {"video/webm"},
}

func init() {
	imageMIMEMap = make(map[string]struct{})
	for _, m := range imageMIMEs {
		imageMIMEMap[m] = struct{}{}
	}
	videoMIMEMap = make(map[string]struct{})
	for _, m := range videoMIMEs {
		videoMIMEMap[m] = struct{}{}
	}
	imageExtMap = make(map[string]struct{})
	for _, e := range imageExts {
		imageExtMap[e] = struct{}{}
	}
	videoExtMap = make(map[string]struct{})
	for _, e := range videoExts {
		videoExtMap[e] = struct{}{}
	}
}

var imageMIMEMap map[string]struct{}
var videoMIMEMap map[string]struct{}
var imageExtMap map[string]struct{}
var videoExtMap map[string]struct{}

// DeriveMediaType 根据 MIME 推导 MediaType；若不是支持的类型则返回 UNSPECIFIED 与错误。
func DeriveMediaType(mime string) (mediav1.MediaType, error) {
	m := normalize(mime)
	if _, ok := imageMIMEMap[m]; ok {
		return mediav1.MediaType_MEDIA_TYPE_IMAGE, nil
	}
	if _, ok := videoMIMEMap[m]; ok {
		return mediav1.MediaType_MEDIA_TYPE_VIDEO, nil
	}
	return mediav1.MediaType_MEDIA_TYPE_UNSPECIFIED, fmt.Errorf("不支持的 mime type: %s", m)
}

// SafeImageExt 将用户提供的扩展名白名单化，不在白名单则返回安全默认 .jpg。
func SafeImageExt(ext string) string {
	ext = strings.ToLower(strings.TrimSpace(ext))
	if _, ok := imageExtMap[ext]; ok {
		return ext
	}
	return ".jpg"
}

// SafeVideoExt 将用户提供的扩展名白名单化，不在白名单则返回安全默认 .mp4。
func SafeVideoExt(ext string) string {
	ext = strings.ToLower(strings.TrimSpace(ext))
	if _, ok := videoExtMap[ext]; ok {
		return ext
	}
	return ".mp4"
}

// MIMEMagicMap 返回「声明 MIME -> 魔数检测可能返回的 MIME 列表」，供 filetype 校验使用。
func MIMEMagicMap() map[string][]string {
	return mimeToDetected
}

func normalize(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
