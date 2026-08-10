package model

import (
	"fmt"
	"strings"

	syncv1 "app.shiningacg.club/gen/proto/api/main/sync/v1"
)

type EventDomain string

const (
	EventDomainSetting      EventDomain = "setting"
	EventDomainSync         EventDomain = "sync"
	EventDomainMedia        EventDomain = "media"
	EventDomainNotification EventDomain = "notification"
	EventDomainChat         EventDomain = "chat"
)

type ParsedEventChannel struct {
	Domain   EventDomain
	UserID   string
	SyncType syncv1.SyncDataType
	BatchID  string
	RoomID   string
}

func SettingEventChannel(userID string, dataType syncv1.SyncDataType) string {
	return fmt.Sprintf("evt.setting.user.%s.%s", normalizeSegment(userID), dataType.String())
}

func SyncEventChannel(userID string, dataType syncv1.SyncDataType) string {
	return SettingEventChannel(userID, dataType)
}

func MediaBatchEventChannel(batchID string) string {
	return fmt.Sprintf("evt.media.batch.%s", normalizeSegment(batchID))
}

func NotificationUserEventChannel(userID string) string {
	return fmt.Sprintf("evt.notification.user.%s", normalizeSegment(userID))
}

func ChatRoomEventChannel(roomID string) string {
	return fmt.Sprintf("evt.chat.room.%s", normalizeSegment(roomID))
}

func ParseEventChannel(channel string) (*ParsedEventChannel, error) {
	channel = strings.TrimSpace(channel)
	if channel == "" {
		return nil, fmt.Errorf("channel is required")
	}
	parts := strings.Split(channel, ".")
	if len(parts) < 4 || parts[0] != "evt" {
		return nil, fmt.Errorf("unsupported event channel: %s", channel)
	}

	domain := parts[1]
	switch domain {
	case string(EventDomainSetting), string(EventDomainSync):
		// evt.setting.user.{user_id}.{sync_type}
		// evt.sync.user.{user_id}.{sync_type} (legacy)
		if len(parts) != 5 || parts[2] != "user" {
			return nil, fmt.Errorf("invalid setting channel: %s", channel)
		}
		userID := strings.TrimSpace(parts[3])
		if userID == "" {
			return nil, fmt.Errorf("setting channel user_id is required")
		}
		syncTypeName := strings.TrimSpace(parts[4])
		syncType, ok := ParseSyncDataType(syncTypeName)
		if !ok {
			return nil, fmt.Errorf("invalid setting type: %s", syncTypeName)
		}
		return &ParsedEventChannel{
			Domain:   EventDomainSetting,
			UserID:   userID,
			SyncType: syncType,
		}, nil
	case string(EventDomainNotification):
		// evt.notification.user.{user_id}
		if len(parts) != 4 || parts[2] != "user" {
			return nil, fmt.Errorf("invalid notification channel: %s", channel)
		}
		userID := strings.TrimSpace(parts[3])
		if userID == "" {
			return nil, fmt.Errorf("notification channel user_id is required")
		}
		return &ParsedEventChannel{
			Domain: EventDomainNotification,
			UserID: userID,
		}, nil
	case string(EventDomainMedia):
		// evt.media.batch.{batch_id}
		if len(parts) != 4 || parts[2] != "batch" {
			return nil, fmt.Errorf("invalid media channel: %s", channel)
		}
		batchID := strings.TrimSpace(parts[3])
		if batchID == "" {
			return nil, fmt.Errorf("media channel batch_id is required")
		}
		return &ParsedEventChannel{
			Domain:  EventDomainMedia,
			BatchID: batchID,
		}, nil
	case string(EventDomainChat):
		// evt.chat.room.{room_id}
		if len(parts) != 4 || parts[2] != "room" {
			return nil, fmt.Errorf("invalid chat channel: %s", channel)
		}
		roomID := strings.TrimSpace(parts[3])
		if roomID == "" {
			return nil, fmt.Errorf("chat channel room_id is required")
		}
		return &ParsedEventChannel{
			Domain: EventDomainChat,
			RoomID: roomID,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported event channel domain: %s", domain)
	}
}

func normalizeSegment(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	return strings.ReplaceAll(trimmed, " ", "_")
}
