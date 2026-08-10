// Package filetype 提供基于文件头（Magic Number）的媒体类型检测，用于上传校验、防止伪造扩展名/MIME 导致的 XSS 或恶意文件。
// 支持的 MIME 白名单由 pkg/mediapolicy 统一管理，此处仅负责魔数检测与对比。
package filetype

import (
	"bytes"
	"errors"
	"strings"

	"app.shiningacg.club/pkg/mediapolicy"
)

// 常见媒体类型的魔数前缀（仅用于与声明 MIME 对比，不做完整格式解析）
var (
	// JPEG: FF D8 FF
	jpegSig = []byte{0xFF, 0xD8, 0xFF}
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	pngSig = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	// WebP: RIFF....WEBP（52 49 46 46 + 4 字节长度 + 57 45 42 50）
	webpRiff = []byte("RIFF")
	webpFcc  = []byte("WEBP")
	// HEIC/HEIF: 第 4 字节起 ftyp，第 8 字节起 mif1/heic/heix
	ftypSig = []byte("ftyp")
	mif1    = []byte("mif1")
	heic    = []byte("heic")
	heix    = []byte("heix")
	// MP4/QuickTime: ....ftyp（偏移 4）
	// WebM/EBML: 0x1A 0x45 0xDF 0xA3
	webmSig = []byte{0x1A, 0x45, 0xDF, 0xA3}
)

// ErrUnsupportedType 表示不支持的或与声明不符的文件类型
var ErrUnsupportedType = errors.New("filetype: 文件头与声明的 MIME 类型不符或不支持")

// DetectMIME 根据文件头魔数检测 MIME 类型（仅支持我们允许的图片/视频类型）。
// data 至少应包含前 12 字节（HEIC 需更多，此处读 16 字节足够 ftyp+brand）。
//
// 返回：检测到的 MIME（如 "image/jpeg"），若无法识别返回空字符串。
func DetectMIME(data []byte) string {
	if len(data) < 12 {
		return ""
	}
	if bytes.HasPrefix(data, jpegSig) {
		return "image/jpeg"
	}
	if bytes.HasPrefix(data, pngSig) {
		return "image/png"
	}
	if len(data) >= 12 && bytes.Equal(data[0:4], webpRiff) && bytes.Equal(data[8:12], webpFcc) {
		return "image/webp"
	}
	// ftyp at offset 4 (ISO base media / HEIC / MP4 / QuickTime)
	if len(data) >= 12 && bytes.Equal(data[4:8], ftypSig) {
		brand := string(data[8:12])
		switch {
		case bytes.Equal(data[8:12], mif1) || bytes.Equal(data[8:12], heic) || bytes.Equal(data[8:12], heix):
			return "image/heic"
		case brand == "mp41" || brand == "mp42" || brand == "isom" || brand == "M4V " || brand == "qt  ":
			// 简化：qt 为 QuickTime，与 mp4 同属 ftyp 家族，统一按 video/mp4 或 video/quicktime 均可
			return "video/mp4"
		default:
			// 其他 ftyp（如 avc1）也按视频
			return "video/mp4"
		}
	}
	if bytes.HasPrefix(data, webmSig) {
		return "video/webm"
	}
	return ""
}

// ValidateContentType 校验文件头是否与声明的 MIME 一致（用于上传后防伪造、XSS）。
// 允许的 MIME 及与魔数检测的映射由 pkg/mediapolicy 统一管理。
//
// 参数：
//   - data: 文件头字节（建议至少 16 字节，如 os.ReadFile 前 512 字节）
//   - declaredMIME: 用户或业务声明的 MIME（如 file.OriginalMime）
//
// 返回：一致为 nil，否则为 ErrUnsupportedType。
func ValidateContentType(data []byte, declaredMIME string) error {
	declaredMIME = strings.TrimSpace(strings.ToLower(declaredMIME))
	mimeToDetected := mediapolicy.MIMEMagicMap()
	allowed, ok := mimeToDetected[declaredMIME]
	if !ok {
		return ErrUnsupportedType
	}
	detected := DetectMIME(data)
	if detected == "" {
		return ErrUnsupportedType
	}
	for _, m := range allowed {
		if m == detected {
			return nil
		}
	}
	return ErrUnsupportedType
}
