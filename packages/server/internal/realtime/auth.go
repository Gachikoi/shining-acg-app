package realtime

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	"github.com/centrifugal/centrifuge"
)

type contextKey string

const (
	contextKeyDeviceID contextKey = "realtime_device_id"
)

func authenticateMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimSpace(r.URL.Query().Get("token"))
		if token == "" {
			http.Error(w, "token is required", http.StatusUnauthorized)
			return
		}

		deviceID := strings.TrimSpace(r.URL.Query().Get("device_id"))
		if deviceID == "" {
			deviceID = "web"
		}

		credentials := &centrifuge.Credentials{UserID: DeriveUserIDFromToken(token)}
		ctx := centrifuge.SetCredentials(r.Context(), credentials)
		ctx = context.WithValue(ctx, contextKeyDeviceID, deviceID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func deviceIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return "web"
	}
	value, _ := ctx.Value(contextKeyDeviceID).(string)
	value = strings.TrimSpace(value)
	if value == "" {
		return "web"
	}
	return value
}

func DeriveUserIDFromToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return fmt.Sprintf("u_%s", hex.EncodeToString(sum[:8]))
}
