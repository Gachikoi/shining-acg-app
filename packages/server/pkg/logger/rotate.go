package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// DailyRotateWriter 实现按天轮转的日志写入器
// 1. 每天生成一个新文件 app-YYYY-MM-DD.log
// 2. 自动清理超过 30 天的旧日志
type DailyRotateWriter struct {
	dir            string
	currentFile    *os.File
	currentDateStr string
	mu             sync.Mutex
}

// NewDailyRotateWriter 创建按天轮转写入器
func NewDailyRotateWriter(dir string) (*DailyRotateWriter, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("无法创建日志目录: %w", err)
	}

	w := &DailyRotateWriter{
		dir: dir,
	}

	// 初始化时执行一次清理
	go w.cleanOldLogs()

	return w, nil
}

// Write 实现 io.Writer 接口
func (w *DailyRotateWriter) Write(p []byte) (n int, err error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// 检查是否需要轮转
	today := time.Now().Format("2006-01-02")
	if w.currentFile == nil || w.currentDateStr != today {
		if err := w.rotate(today); err != nil {
			return 0, err
		}
	}

	return w.currentFile.Write(p)
}

// rotate 执行文件切换
func (w *DailyRotateWriter) rotate(today string) error {
	// 关闭旧文件
	if w.currentFile != nil {
		_ = w.currentFile.Close()
	}

	// 打开新文件
	filename := filepath.Join(w.dir, fmt.Sprintf("app-%s.log", today))
	f, err := os.OpenFile(filename, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("无法打开日志文件: %w", err)
	}

	w.currentFile = f
	w.currentDateStr = today

	// 异步执行旧文件清理
	go w.cleanOldLogs()

	return nil
}

// cleanOldLogs 清理超过 30 天的日志文件
func (w *DailyRotateWriter) cleanOldLogs() {
	entries, err := os.ReadDir(w.dir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "清理日志失败: 无法读取目录 %v\n", err)
		return
	}

	expiration := time.Now().Add(-30 * 24 * time.Hour)

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), "app-") || !strings.HasSuffix(entry.Name(), ".log") {
			continue
		}

		// 解析日期部分 app-2006-01-02.log
		dateStr := strings.TrimSuffix(strings.TrimPrefix(entry.Name(), "app-"), ".log")
		fileTime, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			continue
		}

		if fileTime.Before(expiration) {
			path := filepath.Join(w.dir, entry.Name())
			if err := os.Remove(path); err != nil {
				fmt.Fprintf(os.Stderr, "删除过期日志失败: %s, %v\n", path, err)
			}
		}
	}
}

// Close 关闭文件句柄
func (w *DailyRotateWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.currentFile != nil {
		return w.currentFile.Close()
	}
	return nil
}
