package realtime

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	rtv1 "app.shiningacg.club/gen/proto/api/main/realtime/v1"
	rtv1connect "app.shiningacg.club/gen/proto/api/main/realtime/v1/realtimev1connect"
	rtmodel "app.shiningacg.club/internal/realtime/model"
	syncapp "app.shiningacg.club/internal/sync"
	"connectrpc.com/connect"
)

// RealtimeRPCServiceServer 承载 WS RPC 的业务方法实现。
type RealtimeRPCServiceServer struct {
	rtv1connect.UnimplementedRealtimeRpcServiceHandler
	syncUseCase *syncapp.SyncUseCase
}

func NewRealtimeRPCServiceServer(syncUseCase *syncapp.SyncUseCase) *RealtimeRPCServiceServer {
	return &RealtimeRPCServiceServer{
		syncUseCase: syncUseCase,
	}
}

var _ rtv1connect.RealtimeRpcServiceHandler = (*RealtimeRPCServiceServer)(nil)

func (s *RealtimeRPCServiceServer) SyncSettingsUpdate(
	ctx context.Context,
	req *connect.Request[rtv1.SyncSettingsUpdateRpcRequest],
) (*connect.Response[rtv1.SyncSettingsUpdateRpcResponse], error) {
	if req == nil || req.Msg == nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("request is required"))
	}
	sessionID := strings.TrimSpace(req.Msg.GetSessionId())
	slog.InfoContext(ctx, "SyncSettingsUpdate 请求", "session_id", sessionID, "device_id", req.Msg.GetDeviceId())

	if sessionID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("session_id is required"))
	}
	dataType := strings.TrimSpace(req.Msg.GetDataType())
	if _, ok := rtmodel.ParseSyncDataType(dataType); !ok {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("data_type is required"))
	}

	payload := &rtmodel.SettingsUpdatePayload{
		DataType:             dataType,
		DeviceID:             strings.TrimSpace(req.Msg.GetDeviceId()),
		UserSettings:         req.Msg.GetUserSettings(),
		NotificationSettings: req.Msg.GetNotificationSettings(),
		PrivacySettings:      req.Msg.GetPrivacySettings(),
		ContentCategoryOrder: req.Msg.GetContentCategoryOrder(),
	}
	if err := s.syncUseCase.HandleSettingsUpdate(ctx, sessionID, payload); err != nil {
		slog.WarnContext(ctx, "HandleSettingsUpdate 失败", "session_id", sessionID, "error", err)
		if strings.Contains(err.Error(), "session not found") {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	return connect.NewResponse(&rtv1.SyncSettingsUpdateRpcResponse{
		Success: true,
		Message: "settings synced",
	}), nil
}
