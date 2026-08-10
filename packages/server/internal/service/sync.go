package service

import (
	"context"
	"errors"
	"strconv"
	"strings"

	syncv1 "app.shiningacg.club/gen/proto/api/main/sync/v1"
	syncv1connect "app.shiningacg.club/gen/proto/api/main/sync/v1/syncv1connect"
	realtime "app.shiningacg.club/internal/realtime"
	syncapp "app.shiningacg.club/internal/sync"
	"connectrpc.com/connect"
)

type SyncServiceServer struct {
	syncv1connect.UnimplementedSyncServiceHandler
	useCase *syncapp.SyncUseCase
}

func NewSyncServiceServer(useCase *syncapp.SyncUseCase) *SyncServiceServer {
	return &SyncServiceServer{useCase: useCase}
}

var _ syncv1connect.SyncServiceHandler = (*SyncServiceServer)(nil)

func (s *SyncServiceServer) GetSyncStatus(_ context.Context, req *connect.Request[syncv1.GetSyncStatusRequest]) (*connect.Response[syncv1.GetSyncStatusResponse], error) {
	userID, _ := userContextFromRequest(req)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("token is required"))
	}
	return connect.NewResponse(&syncv1.GetSyncStatusResponse{
		Status: s.useCase.GetSyncStatus(userID),
	}), nil
}

func (s *SyncServiceServer) GetActiveDevices(_ context.Context, req *connect.Request[syncv1.GetActiveDevicesRequest]) (*connect.Response[syncv1.GetActiveDevicesResponse], error) {
	userID, deviceID := userContextFromRequest(req)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("token is required"))
	}
	return connect.NewResponse(&syncv1.GetActiveDevicesResponse{
		Devices: s.useCase.GetActiveDevices(userID, deviceID),
	}), nil
}

func (s *SyncServiceServer) ForceSync(ctx context.Context, req *connect.Request[syncv1.ForceSyncRequest]) (*connect.Response[syncv1.ForceSyncResponse], error) {
	userID, _ := userContextFromRequest(req)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("token is required"))
	}
	count, err := s.useCase.ForceSync(ctx, userID, req.Msg.GetSyncTypes())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	return connect.NewResponse(&syncv1.ForceSyncResponse{
		Success: true,
		Message: "pushed sessions: " + strconv.Itoa(count),
	}), nil
}

func (s *SyncServiceServer) DisconnectDevice(ctx context.Context, req *connect.Request[syncv1.DisconnectDeviceRequest]) (*connect.Response[syncv1.DisconnectDeviceResponse], error) {
	userID, _ := userContextFromRequest(req)
	if userID == "" {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("token is required"))
	}
	deviceID := strings.TrimSpace(req.Msg.GetDeviceId())
	if deviceID == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("device_id is required"))
	}
	count := s.useCase.DisconnectDevice(ctx, userID, deviceID)
	return connect.NewResponse(&syncv1.DisconnectDeviceResponse{
		Success: count > 0,
	}), nil
}

func userContextFromRequest(req connect.AnyRequest) (userID string, deviceID string) {
	authHeader := strings.TrimSpace(req.Header().Get("Authorization"))
	token := ""
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		return "", ""
	}
	deviceID = strings.TrimSpace(req.Header().Get("X-Device-ID"))
	return realtime.DeriveUserIDFromToken(token), deviceID
}
