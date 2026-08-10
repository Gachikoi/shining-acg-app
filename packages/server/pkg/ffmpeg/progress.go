package ffmpeg

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
)

// ProgressInfo 包含从 ffmpeg -progress 输出解析的进度信息
type ProgressInfo struct {
	Frame      int64
	FPS        float64
	Bitrate    string
	TotalSize  int64
	OutTimeUs  int64 // 微秒
	OutTimeMs  int64 // 毫秒
	OutTime    string
	DupFrames  int
	DropFrames int
	Speed      float64
	Progress   float64 // 0-100，仅当已知总时长时有效
}

// ProgressCallback 定义进度回调函数类型
type ProgressCallback func(info ProgressInfo)

// RunWithProgress 执行 ffmpeg 命令并实时解析进度
// dir: 工作目录，如果为空则使用当前目录
// args: ffmpeg 参数（不包含 -progress 相关参数，函数会自动添加）
// totalDurationMs: 媒体总时长（毫秒），用于计算百分比。如果未知，传 0。
// callback: 进度回调函数
func RunWithProgress(ctx context.Context, dir string, args []string, totalDurationMs int64, callback ProgressCallback) error {
	// 使用 pipe:1 (stdout) 输出进度信息
	// 注意：ffmpeg 默认将日志输出到 stderr，处理后的数据输出到 stdout（如果指定了 -f image2pipe 等）。
	// 如果是处理文件到文件，stdout 通常为空，可以用作进度输出。
	cmdArgs := append([]string{"-hide_banner", "-progress", "pipe:1"}, args...)

	cmd := exec.CommandContext(ctx, "ffmpeg", cmdArgs...)
	if dir != "" {
		cmd.Dir = dir
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	// 捕获 stderr 用于错误报告
	stderrReader, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %w", err)
	}

	// 异步读取 stderr
	var stderrBuilder strings.Builder
	go func() {
		_, _ = io.Copy(&stderrBuilder, stderrReader)
	}()

	// 解析 stdout 中的进度信息
	// ffmpeg 的 progress 输出格式为 key=value\nkey=value\n...
	scanner := bufio.NewScanner(stdout)
	var currentProgress ProgressInfo

	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key, value := strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1])

		switch key {
		case "frame":
			currentProgress.Frame, _ = strconv.ParseInt(value, 10, 64)
		case "fps":
			currentProgress.FPS, _ = strconv.ParseFloat(value, 64)
		case "bitrate":
			currentProgress.Bitrate = value
		case "total_size":
			currentProgress.TotalSize, _ = strconv.ParseInt(value, 10, 64)
		case "out_time_us":
			us, _ := strconv.ParseInt(value, 10, 64)
			currentProgress.OutTimeUs = us
			currentProgress.OutTimeMs = us / 1000
		case "out_time":
			currentProgress.OutTime = value
		case "dup_frames":
			currentProgress.DupFrames, _ = strconv.Atoi(value)
		case "drop_frames":
			currentProgress.DropFrames, _ = strconv.Atoi(value)
		case "speed":
			// value 格式可能是 "3.5x" 或 "3.5"
			val := strings.TrimSuffix(value, "x")
			currentProgress.Speed, _ = strconv.ParseFloat(val, 64)
		case "progress":
			// "continue" 或 "end"
			if key == "progress" {
				if totalDurationMs > 0 && currentProgress.OutTimeMs > 0 {
					percent := float64(currentProgress.OutTimeMs) / float64(totalDurationMs) * 100
					if percent > 100 {
						percent = 100
					}
					currentProgress.Progress = percent
				}
				if callback != nil {
					callback(currentProgress)
				}
			}
		}
	}

	if err := cmd.Wait(); err != nil {
		// 读取最后 1000 个字符的 stderr
		errMsg := stderrBuilder.String()
		if len(errMsg) > 1000 {
			errMsg = errMsg[len(errMsg)-1000:]
		}
		return fmt.Errorf("ffmpeg execution failed: %w, stderr: %s", err, errMsg)
	}

	return nil
}
