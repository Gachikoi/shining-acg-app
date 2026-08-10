package model

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	syncv1 "app.shiningacg.club/gen/proto/api/main/sync/v1"
	userv1 "app.shiningacg.club/gen/proto/api/main/user/v1"
	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
)

type MessageType string

const (
	MessageTypeSubscribe         MessageType = "WS_MESSAGE_TYPE_SUBSCRIBE"
	MessageTypeUnsubscribe       MessageType = "WS_MESSAGE_TYPE_UNSUBSCRIBE"
	MessageTypeSettingsUpdate    MessageType = "WS_MESSAGE_TYPE_SETTINGS_UPDATE"
	MessageTypeSettingsSync      MessageType = "WS_MESSAGE_TYPE_SETTINGS_SYNC"
	MessageTypeMediaProgress     MessageType = "WS_MESSAGE_TYPE_MEDIA_PROGRESS"
	MessageTypeNotificationEvent MessageType = "WS_MESSAGE_TYPE_NOTIFICATION_EVENT"
	MessageTypeChatEvent         MessageType = "WS_MESSAGE_TYPE_CHAT_EVENT"
	MessageTypeError             MessageType = "WS_MESSAGE_TYPE_ERROR"
	MessageTypeAck               MessageType = "WS_MESSAGE_TYPE_ACK"
)

type Envelope struct {
	MessageID       string                    `json:"message_id,omitempty"`
	Type            MessageType               `json:"type"`
	TimestampMs     string                    `json:"timestamp_ms,omitempty"`
	Subscribe       *ChannelSubscription      `json:"subscribe,omitempty"`
	Unsubscribe     *ChannelSubscription      `json:"unsubscribe,omitempty"`
	SettingsUpdate  *SettingsUpdatePayload    `json:"settings_update,omitempty"`
	SettingsSync    *SettingsSyncPayload      `json:"settings_sync,omitempty"`
	MediaProgress   *MediaProgressPayload     `json:"media_progress,omitempty"`
	NotificationEvt *NotificationEventPayload `json:"notification_event,omitempty"`
	ChatEvent       *ChatEventPayload         `json:"chat_event,omitempty"`
	Error           *ErrorPayload             `json:"error,omitempty"`
	Ack             *AckPayload               `json:"ack,omitempty"`
}

type ChannelSubscription struct {
	SyncTypes     []string `json:"sync_types,omitempty"`
	MediaBatchIDs []string `json:"media_batch_ids,omitempty"`
	Notification  bool     `json:"notification,omitempty"`
	ChatRoomIDs   []string `json:"chat_room_ids,omitempty"`
}

type SettingsUpdatePayload struct {
	DataType             string                             `json:"data_type,omitempty"`
	DeviceID             string                             `json:"device_id,omitempty"`
	UserSettings         *userv1.SyncedUserSettings         `json:"user_settings,omitempty"`
	NotificationSettings *userv1.SyncedNotificationSettings `json:"notification_settings,omitempty"`
	PrivacySettings      *userv1.SyncedPrivacySettings      `json:"privacy_settings,omitempty"`
	ContentCategoryOrder *userv1.SyncedContentCategoryOrder `json:"content_category_order,omitempty"`
}

type SettingsSyncPayload struct {
	DataType             string                             `json:"data_type,omitempty"`
	Version              int64                              `json:"version,omitempty"`
	SourceDeviceID       string                             `json:"source_device_id,omitempty"`
	UserSettings         *userv1.SyncedUserSettings         `json:"user_settings,omitempty"`
	NotificationSettings *userv1.SyncedNotificationSettings `json:"notification_settings,omitempty"`
	PrivacySettings      *userv1.SyncedPrivacySettings      `json:"privacy_settings,omitempty"`
	ContentCategoryOrder *userv1.SyncedContentCategoryOrder `json:"content_category_order,omitempty"`
}

type MediaProgressPayload struct {
	Progress *mediav1.BatchProgress `json:"progress,omitempty"`
}

type NotificationEventPayload struct {
	EventType string `json:"event_type,omitempty"`
	Message   string `json:"message,omitempty"`
}

type ChatEventPayload struct {
	EventType string `json:"event_type,omitempty"`
	Message   string `json:"message,omitempty"`
}

type ErrorPayload struct {
	Code    string            `json:"code,omitempty"`
	Message string            `json:"message,omitempty"`
	Details map[string]string `json:"details,omitempty"`
}

type AckPayload struct {
	RefMessageID string `json:"ref_message_id,omitempty"`
	Success      bool   `json:"success"`
	Message      string `json:"message,omitempty"`
}

func NewAck(refMessageID, message string) *Envelope {
	return &Envelope{
		MessageID:   buildMessageID(),
		Type:        MessageTypeAck,
		TimestampMs: nowTimestampMs(),
		Ack: &AckPayload{
			RefMessageID: strings.TrimSpace(refMessageID),
			Success:      true,
			Message:      message,
		},
	}
}

func NewError(code, message string) *Envelope {
	return &Envelope{
		MessageID:   buildMessageID(),
		Type:        MessageTypeError,
		TimestampMs: nowTimestampMs(),
		Error: &ErrorPayload{
			Code:    strings.TrimSpace(code),
			Message: strings.TrimSpace(message),
		},
	}
}

func NewSettingsSync(payload *SettingsSyncPayload) *Envelope {
	return &Envelope{
		MessageID:    buildMessageID(),
		Type:         MessageTypeSettingsSync,
		TimestampMs:  nowTimestampMs(),
		SettingsSync: payload,
	}
}

func NewMediaProgress(progress *mediav1.BatchProgress) *Envelope {
	return &Envelope{
		MessageID:   buildMessageID(),
		Type:        MessageTypeMediaProgress,
		TimestampMs: nowTimestampMs(),
		MediaProgress: &MediaProgressPayload{
			Progress: progress,
		},
	}
}

func NewNotificationEvent(event *NotificationEventPayload) *Envelope {
	return &Envelope{
		MessageID:       buildMessageID(),
		Type:            MessageTypeNotificationEvent,
		TimestampMs:     nowTimestampMs(),
		NotificationEvt: event,
	}
}

func NewChatEvent(event *ChatEventPayload) *Envelope {
	return &Envelope{
		MessageID:   buildMessageID(),
		Type:        MessageTypeChatEvent,
		TimestampMs: nowTimestampMs(),
		ChatEvent:   event,
	}
}

func ParseSyncDataType(raw string) (syncv1.SyncDataType, bool) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return syncv1.SyncDataType_SYNC_DATA_TYPE_UNSPECIFIED, false
	}
	value, ok := syncv1.SyncDataType_value[name]
	if !ok {
		return syncv1.SyncDataType_SYNC_DATA_TYPE_UNSPECIFIED, false
	}
	t := syncv1.SyncDataType(value)
	if t == syncv1.SyncDataType_SYNC_DATA_TYPE_UNSPECIFIED {
		return t, false
	}
	return t, true
}

func NormalizeSyncTypeNames(values []string) ([]syncv1.SyncDataType, error) {
	seen := make(map[syncv1.SyncDataType]struct{}, len(values))
	result := make([]syncv1.SyncDataType, 0, len(values))
	for _, value := range values {
		t, ok := ParseSyncDataType(value)
		if !ok {
			return nil, fmt.Errorf("invalid sync type: %s", strings.TrimSpace(value))
		}
		if _, exists := seen[t]; exists {
			continue
		}
		seen[t] = struct{}{}
		result = append(result, t)
	}
	return result, nil
}

func nowTimestampMs() string {
	return strconv.FormatInt(time.Now().UnixMilli(), 10)
}

func buildMessageID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
