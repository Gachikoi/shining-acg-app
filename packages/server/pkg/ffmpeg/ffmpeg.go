package ffmpeg

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// TranscodeConfig 转码配置参数
type TranscodeConfig struct {
	VideoBitrate string    // 例如 "1500k"
	AudioBitrate string    // 例如 "128k"
	Height       int       // 目标高度，例如 720
	HLSTime      int       // HLS 切片时间（秒）
	LogWriter    io.Writer // 用于接收 ffmpeg 的 stderr 日志，如果为 nil 则默认只在报错时返回部分日志
}

// DefaultConfig 获取默认配置
func DefaultConfig() *TranscodeConfig {
	return &TranscodeConfig{
		VideoBitrate: "1500k",
		AudioBitrate: "128k",
		Height:       720,
		HLSTime:      6,
		LogWriter:    nil,
	}
}

// VideoMeta 视频元数据
type VideoMeta struct {
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Duration int    `json:"duration"` // 秒
	Size     int64  `json:"size"`     // 字节
	MimeType string `json:"mime_type"`
}

// ImageMeta 图片元数据
type ImageMeta struct {
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Size     int64  `json:"size"`
	MimeType string `json:"mime_type"`
}

// mapFormatToMimeType 将 ffprobe 的 format_name 映射为标准的 MIME Type
func mapFormatToMimeType(formatName, codecType string) string {
	// ffprobe 返回的 format_name 可能是逗号分隔的，如 "mov,mp4,m4a,3gp,3g2,mj2"
	formats := strings.Split(formatName, ",")
	baseFormat := formats[0]

	switch baseFormat {
	case "matroska":
		return "video/x-matroska"
	case "mov", "mp4", "m4a":
		return "video/mp4"
	case "hls":
		return "application/x-mpegURL"
	case "avi":
		return "video/x-msvideo"
	case "flv":
		return "video/x-flv"
	case "mpeg":
		return "video/mpeg"
	case "webm":
		return "video/webm"
	case "image2", "png":
		return "image/png"
	case "jpeg", "jpg":
		return "image/jpeg"
	case "webp":
		return "image/webp"
	case "gif":
		return "image/gif"
	default:
		// 兜底策略
		if codecType == "video" {
			return "video/" + baseFormat
		} else if codecType == "image" {
			return "image/" + baseFormat
		}
		return "application/octet-stream"
	}
}

// runFFmpegCommand 执行 ffmpeg 命令的通用封装
func runFFmpegCommand(ctx context.Context, args []string, logWriter io.Writer) error {
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	// 处理 stderr
	// 如果调用者提供了 writer (如 os.Stdout 或 文件)，则实时写入
	// 否则，为了避免 buffer 无限增长，我们默认丢弃，只有在出错时，
	// 这里的实现比较简化：如果没传 logWriter，出错时我们可能拿不到完整的 stderr。
	// 生产环境建议：使用一个由 RingBuffer 实现的 Writer 来缓存最近 N 行日志供报错使用。

	var errBuf bytes.Buffer
	if logWriter != nil {
		cmd.Stderr = io.MultiWriter(logWriter, &errBuf) // 既写入用户提供的writer，也稍微存一点用于报错返回
	} else {
		cmd.Stderr = &errBuf
	}
	// ffmpeg 的正常输出通常为空，除非是特定 pipe 操作，这里设为 nil 或 Discard
	cmd.Stdout = io.Discard

	if err := cmd.Run(); err != nil {
		// 截取一部分 stderr 用于错误提示，避免错误信息过长
		errMsg := errBuf.String()
		if len(errMsg) > 1000 {
			errMsg = errMsg[len(errMsg)-1000:] // 只取最后 1000 字符
		}
		return fmt.Errorf("ffmpeg execution failed: %w, last stderr: %s", err, errMsg)
	}
	return nil
}

// GetMeta 获取视频元数据
func GetMeta(ctx context.Context, inputPath string) (*VideoMeta, error) {
	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		inputPath,
	)

	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	// ffprobe 错误信息通常较短，可以直接捕获
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffprobe failed: %w, stderr: %s", err, stderr.String())
	}

	var probeData struct {
		Format struct {
			Duration   string `json:"duration"`
			Size       string `json:"size"`
			FormatName string `json:"format_name"`
		} `json:"format"`
		Streams []struct {
			CodecType string `json:"codec_type"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(stdout.Bytes(), &probeData); err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %w", err)
	}

	var width, height int
	for _, stream := range probeData.Streams {
		if stream.CodecType == "video" {
			width = stream.Width
			height = stream.Height
			break
		}
	}

	duration, _ := strconv.ParseFloat(probeData.Format.Duration, 64)
	size, _ := strconv.ParseInt(probeData.Format.Size, 10, 64)

	return &VideoMeta{
		Width:    width,
		Height:   height,
		Duration: int(duration),
		Size:     size,
		MimeType: mapFormatToMimeType(probeData.Format.FormatName, "video"),
	}, nil
}

// TranscodeToHLS 将视频转码为 HLS (m4s 切片)
func TranscodeToHLS(ctx context.Context, inputPath, outputDir string, config *TranscodeConfig) error {
	if config == nil {
		config = DefaultConfig()
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	args := []string{
		"-i", inputPath,
		"-hls_time", strconv.Itoa(config.HLSTime),
		"-hls_list_size", "0",
		"-hls_segment_type", "fmp4",
		"-hls_segment_filename", "seg_%03d.m4s",
		"-vcodec", "h264",
		"-acodec", "aac",
		"-vf", fmt.Sprintf("scale=-2:%d", config.Height), // 动态分辨率
		"-b:v", config.VideoBitrate,
		"-b:a", config.AudioBitrate,
		"-f", "hls",
		"index.m3u8",
	}

	// 使用 runFFmpegCommandWithWorkingDir 执行命令，确保路径是相对的
	return runFFmpegCommandWithWorkingDir(ctx, outputDir, args, config.LogWriter)
}

// runFFmpegCommandWithWorkingDir 在指定的工作目录下执行 ffmpeg 命令
func runFFmpegCommandWithWorkingDir(ctx context.Context, workingDir string, args []string, logWriter io.Writer) error {
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	cmd.Dir = workingDir // 设置工作目录

	var errBuf bytes.Buffer
	if logWriter != nil {
		cmd.Stderr = io.MultiWriter(logWriter, &errBuf) // 既写入用户提供的writer，也稍微存一点用于报错返回
	} else {
		cmd.Stderr = &errBuf
	}
	cmd.Stdout = io.Discard

	if err := cmd.Run(); err != nil {
		errMsg := errBuf.String()
		if len(errMsg) > 1000 {
			errMsg = errMsg[len(errMsg)-1000:] // 只取最后 1000 字符
		}
		return fmt.Errorf("ffmpeg execution failed: %w, last stderr: %s", err, errMsg)
	}
	return nil
}

// CompressToMP4 压缩视频为 MP4
//func CompressToMP4(ctx context.Context, inputPath, outputPath string, config *TranscodeConfig) error {
//	if config == nil {
//		config = DefaultConfig()
//	}
//
//	args := []string{
//		"-i", inputPath,
//		"-vcodec", "h264",
//		"-acodec", "aac",
//		"-vf", fmt.Sprintf("scale=-2:%d", config.Height),
//		"-b:v", config.VideoBitrate,
//		"-b:a", config.AudioBitrate,
//		outputPath,
//	}
//
//	return runFFmpegCommand(ctx, args, config.LogWriter)
//}

// GenerateCover 生成视频封面（截取指定时间的帧）
func GenerateCover(ctx context.Context, inputPath, outputPath string, timeOffset string) error {
	// 默认截取第一秒
	if timeOffset == "" {
		timeOffset = "00:00:01"
	}

	args := []string{
		"-i", inputPath,
		"-ss", timeOffset,
		"-vframes", "1",
		"-vf", "scale=-2:720", // 封面图通常不需要特别高的配置，这里暂时硬编码，也可以提取配置
		"-q:v", "2",
		outputPath,
	}

	return runFFmpegCommand(ctx, args, nil)
}

// CompressImage 压缩图片为 webp 格式
// 如果 width 或 height 为 0，则保持宽高比
func CompressImage(ctx context.Context, inputPath, outputPath string, targetWidth, targetHeight int) error {
	var scaleFilter string
	if targetWidth > 0 && targetHeight > 0 {
		// 保持宽高比，按最小边缩放，避免拉伸
		scaleFilter = fmt.Sprintf("scale='if(gt(iw,ih),%d,-1)':'if(gt(iw,ih),-1,%d)'", targetWidth, targetHeight)
	} else if targetWidth > 0 {
		scaleFilter = fmt.Sprintf("scale=%d:-2", targetWidth)
	} else if targetHeight > 0 {
		scaleFilter = fmt.Sprintf("scale=-2:%d", targetHeight)
	} else {
		// 不改变尺寸，只压缩质量
		scaleFilter = ""
	}

	args := []string{
		"-i", inputPath,
		"-q:v", "80",
	}

	if scaleFilter != "" {
		args = append(args, "-vf", scaleFilter)
	}

	args = append(args, outputPath)

	return runFFmpegCommand(ctx, args, nil)
}

// GetImageMeta 获取图片元数据
func GetImageMeta(ctx context.Context, inputPath string) (*ImageMeta, error) {
	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		inputPath,
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffprobe failed: %w, stderr: %s", err, stderr.String())
	}

	var probeData struct {
		Format struct {
			Size       string `json:"size"`
			FormatName string `json:"format_name"`
		} `json:"format"`
		Streams []struct {
			CodecType string `json:"codec_type"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(stdout.Bytes(), &probeData); err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %w", err)
	}

	var width, height int
	for _, stream := range probeData.Streams {
		if stream.CodecType == "video" || stream.CodecType == "image" {
			width = stream.Width
			height = stream.Height
			break
		}
	}

	size, _ := strconv.ParseInt(probeData.Format.Size, 10, 64)

	// 修正：这里返回的不应该是 image/webp，而是源文件的实际 mime type
	// 除非这个函数是用于检测 "转换后" 的文件，否则应该动态判断
	mimeType := mapFormatToMimeType(probeData.Format.FormatName, "image")

	return &ImageMeta{
		Width:    width,
		Height:   height,
		Size:     size,
		MimeType: mimeType,
	}, nil
}
