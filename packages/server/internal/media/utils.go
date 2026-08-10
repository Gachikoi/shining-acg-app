package media

import (
	"log/slog"
	"os"
	"strings"
)

func osRemove(path string) {
	if err := os.Remove(path); err != nil {
		slog.Warn("os.Remove 失败", "path", path, "err", err)
	}
}

func osRemoveAll(path string) {
	if err := os.RemoveAll(path); err != nil {
		slog.Warn("os.RemoveAll 失败", "path", path, "err", err)
	}
}

func normalizeETag(etag string) string {
	trimmed := strings.TrimSpace(etag)
	trimmed = strings.TrimPrefix(trimmed, "W/")
	return strings.Trim(trimmed, "\"")
}

func normalizeMime(mime string) string {
	return strings.ToLower(strings.TrimSpace(mime))
}
