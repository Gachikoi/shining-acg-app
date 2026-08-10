package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	rtv1 "app.shiningacg.club/gen/proto/api/main/realtime/v1"
	"app.shiningacg.club/internal/realtime/model"
	syncapp "app.shiningacg.club/internal/sync"
	"connectrpc.com/connect"
	"github.com/centrifugal/centrifuge"
)

const (
	rpcMethodSyncSettingsUpdate = "/api.main.realtime.v1.RealtimeRpcService/SyncSettingsUpdate"
)

var errSubscribePermissionDenied = errors.New("subscribe permission denied")

type Hub struct {
	node        *centrifuge.Node
	handler     http.Handler
	syncUseCase *syncapp.SyncUseCase
	rpcService  *RealtimeRPCServiceServer
}

func NewHub(syncUseCase *syncapp.SyncUseCase) (*Hub, error) {
	node, err := centrifuge.New(centrifuge.Config{})
	if err != nil {
		return nil, err
	}

	hub := &Hub{
		node:        node,
		syncUseCase: syncUseCase,
		rpcService:  NewRealtimeRPCServiceServer(syncUseCase),
	}
	hub.syncUseCase.SetPublisher(hub)
	hub.bindEvents()

	if err := node.Run(); err != nil {
		return nil, err
	}

	wsHandler := centrifuge.NewWebsocketHandler(node, centrifuge.WebsocketConfig{})
	hub.handler = authenticateMiddleware(wsHandler)
	return hub, nil
}

func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.handler.ServeHTTP(w, r)
}

func (h *Hub) Shutdown(ctx context.Context) error {
	if h.node == nil {
		return nil
	}
	return h.node.Shutdown(ctx)
}

func (h *Hub) Publish(channel string, payload any) error {
	channel = strings.TrimSpace(channel)
	if channel == "" {
		return fmt.Errorf("channel is required")
	}
	slog.Debug("发布到频道", "channel", channel) // Debug 级别避免刷屏
	if payload == nil {
		return fmt.Errorf("payload is required")
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = h.node.Publish(channel, data)
	return err
}

func (h *Hub) PublishNotificationEvent(userID string, event *model.NotificationEventPayload) error {
	return h.Publish(model.NotificationUserEventChannel(userID), event)
}

func (h *Hub) PublishChatEvent(roomID string, event *model.ChatEventPayload) error {
	return h.Publish(model.ChatRoomEventChannel(roomID), event)
}

func (h *Hub) bindEvents() {
	h.node.OnConnecting(func(ctx context.Context, _ centrifuge.ConnectEvent) (centrifuge.ConnectReply, error) {
		credentials, ok := centrifuge.GetCredentials(ctx)
		if !ok {
			slog.WarnContext(ctx, "客户端连接失败: 无效凭证")
			return centrifuge.ConnectReply{}, centrifuge.DisconnectInvalidToken
		}

		deviceID := deviceIDFromContext(ctx)
		slog.InfoContext(ctx, "客户端正在连接", "user_id", credentials.UserID, "device_id", deviceID)

		data, err := json.Marshal(map[string]string{
			"user_id":   credentials.UserID,
			"device_id": deviceID,
		})
		if err != nil {
			return centrifuge.ConnectReply{}, centrifuge.ErrorInternal
		}
		return centrifuge.ConnectReply{Data: data}, nil
	})

	h.node.OnConnect(func(client *centrifuge.Client) {
		sessionID := client.ID()
		userID := client.UserID()
		deviceID := deviceIDFromContext(client.Context())

		slog.InfoContext(client.Context(), "客户端已连接", "session_id", sessionID, "user_id", userID, "device_id", deviceID)

		h.syncUseCase.RegisterSession(sessionID, userID, deviceID, func() {
			client.Disconnect(centrifuge.DisconnectForceNoReconnect)
		})

		client.OnDisconnect(func(_ centrifuge.DisconnectEvent) {
			slog.InfoContext(client.Context(), "客户端已断开", "session_id", sessionID, "user_id", userID)
			h.syncUseCase.UnregisterSession(sessionID)
		})

		client.OnSubscribe(func(event centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
			slog.DebugContext(client.Context(), "客户端订阅", "channel", event.Channel, "user_id", userID)
			h.syncUseCase.TouchSession(sessionID)
			if err := h.handleSubscribe(client, event.Channel); err != nil {
				slog.WarnContext(client.Context(), "订阅失败", "channel", event.Channel, "error", err)
				if errors.Is(err, errSubscribePermissionDenied) {
					cb(centrifuge.SubscribeReply{}, centrifuge.ErrorPermissionDenied)
					return
				}
				cb(centrifuge.SubscribeReply{}, centrifuge.ErrorBadRequest)
				return
			}
			cb(centrifuge.SubscribeReply{}, nil)
		})

		client.OnRPC(func(event centrifuge.RPCEvent, cb centrifuge.RPCCallback) {
			slog.InfoContext(client.Context(), "RPC 调用", "method", event.Method, "user_id", userID)
			h.syncUseCase.TouchSession(sessionID)
			reply, err := h.handleRPC(client, event)
			if err != nil {
				slog.ErrorContext(client.Context(), "RPC 失败", "method", event.Method, "error", err)
				cb(centrifuge.RPCReply{}, rpcErrorToCentrifuge(err))
				return
			}
			cb(reply, nil)
		})

		client.OnMessage(func(event centrifuge.MessageEvent) {
			h.syncUseCase.TouchSession(sessionID)
			_ = h.handleMessage(client, event)
		})

		client.OnPublish(func(_ centrifuge.PublishEvent, cb centrifuge.PublishCallback) {
			h.syncUseCase.TouchSession(sessionID)
			cb(centrifuge.PublishReply{}, centrifuge.ErrorPermissionDenied)
		})
	})
}

func (h *Hub) handleSubscribe(client *centrifuge.Client, channel string) error {
	parsed, err := model.ParseEventChannel(channel)
	if err != nil {
		return err
	}
	switch parsed.Domain {
	case model.EventDomainSetting, model.EventDomainNotification:
		if parsed.UserID != client.UserID() {
			return errSubscribePermissionDenied
		}
	case model.EventDomainMedia, model.EventDomainChat:
		// 本次仅做频道格式与非空校验，资源归属/成员校验后续补充。
	default:
		return fmt.Errorf("unsupported event channel domain: %s", parsed.Domain)
	}
	return nil
}

func (h *Hub) handleRPC(client *centrifuge.Client, event centrifuge.RPCEvent) (centrifuge.RPCReply, error) {
	method := strings.TrimSpace(event.Method)
	slog.DebugContext(client.Context(), "处理 RPC", "method", method, "user_id", client.UserID())
	switch method {
	case rpcMethodSyncSettingsUpdate:
		var req rtv1.SyncSettingsUpdateRpcRequest
		if len(event.Data) > 0 {
			if err := json.Unmarshal(event.Data, &req); err != nil {
				return centrifuge.RPCReply{}, fmt.Errorf("invalid rpc payload: %w", err)
			}
		}
		req.SessionId = client.ID()
		if strings.TrimSpace(req.DeviceId) == "" {
			req.DeviceId = deviceIDFromContext(client.Context())
		}
		resp, err := h.rpcService.SyncSettingsUpdate(client.Context(), connect.NewRequest(&req))
		if err != nil {
			return centrifuge.RPCReply{}, err
		}
		data, err := json.Marshal(resp.Msg)
		if err != nil {
			return centrifuge.RPCReply{}, err
		}
		return centrifuge.RPCReply{Data: data}, nil
	default:
		return centrifuge.RPCReply{}, fmt.Errorf("unsupported rpc method: %s", method)
	}
}

type inboundMessage struct {
	Method string `json:"method,omitempty"`
}

func (h *Hub) handleMessage(_ *centrifuge.Client, event centrifuge.MessageEvent) error {
	var msg inboundMessage
	_ = json.Unmarshal(event.Data, &msg)
	if strings.TrimSpace(msg.Method) == "" {
		return nil
	}
	return nil
}

func rpcErrorToCentrifuge(err error) error {
	var connectErr *connect.Error
	if !errors.As(err, &connectErr) {
		return centrifuge.ErrorBadRequest
	}
	switch connectErr.Code() {
	case connect.CodePermissionDenied:
		return centrifuge.ErrorPermissionDenied
	case connect.CodeUnauthenticated:
		return centrifuge.ErrorUnauthorized
	case connect.CodeInternal:
		return centrifuge.ErrorInternal
	default:
		return centrifuge.ErrorBadRequest
	}
}
