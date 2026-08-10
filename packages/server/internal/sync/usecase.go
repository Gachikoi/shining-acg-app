package sync

import (
	"context"
	"fmt"
	"strings"
	gosync "sync"
	"time"

	syncv1 "app.shiningacg.club/gen/proto/api/main/sync/v1"
	rtmodel "app.shiningacg.club/internal/realtime/model"
)

type Publisher interface {
	Publish(channel string, payload any) error
}

type sessionState struct {
	sessionID     string
	userID        string
	deviceID      string
	connectedAtMs int64
	lastActiveMs  int64
	disconnectFn  func()
}

type SyncUseCase struct {
	mu             gosync.RWMutex
	publisher      Publisher
	sessions       map[string]*sessionState
	sessionsByUser map[string]map[string]*sessionState
	versions       map[string]map[syncv1.SyncDataType]int64
	latest         map[string]map[syncv1.SyncDataType]*rtmodel.SettingsSyncPayload
	lastSyncAtMs   map[string]int64
}

func NewSyncUseCase() *SyncUseCase {
	return &SyncUseCase{
		sessions:       make(map[string]*sessionState),
		sessionsByUser: make(map[string]map[string]*sessionState),
		versions:       make(map[string]map[syncv1.SyncDataType]int64),
		latest:         make(map[string]map[syncv1.SyncDataType]*rtmodel.SettingsSyncPayload),
		lastSyncAtMs:   make(map[string]int64),
	}
}

func (uc *SyncUseCase) SetPublisher(publisher Publisher) {
	uc.mu.Lock()
	uc.publisher = publisher
	uc.mu.Unlock()
}

func (uc *SyncUseCase) RegisterSession(sessionID, userID, deviceID string, disconnectFn func()) {
	sessionID = strings.TrimSpace(sessionID)
	userID = strings.TrimSpace(userID)
	deviceID = strings.TrimSpace(deviceID)
	if sessionID == "" || userID == "" {
		return
	}
	if deviceID == "" {
		deviceID = "web"
	}

	now := time.Now().UnixMilli()
	state := &sessionState{
		sessionID:     sessionID,
		userID:        userID,
		deviceID:      deviceID,
		connectedAtMs: now,
		lastActiveMs:  now,
		disconnectFn:  disconnectFn,
	}

	uc.mu.Lock()
	defer uc.mu.Unlock()
	uc.sessions[sessionID] = state
	if _, ok := uc.sessionsByUser[userID]; !ok {
		uc.sessionsByUser[userID] = make(map[string]*sessionState)
	}
	uc.sessionsByUser[userID][sessionID] = state
}

func (uc *SyncUseCase) UnregisterSession(sessionID string) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return
	}

	uc.mu.Lock()
	defer uc.mu.Unlock()
	state, ok := uc.sessions[sessionID]
	if !ok {
		return
	}
	delete(uc.sessions, sessionID)
	if userSessions, exists := uc.sessionsByUser[state.userID]; exists {
		delete(userSessions, sessionID)
		if len(userSessions) == 0 {
			delete(uc.sessionsByUser, state.userID)
		}
	}
}

func (uc *SyncUseCase) TouchSession(sessionID string) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return
	}
	uc.mu.Lock()
	if state, ok := uc.sessions[sessionID]; ok {
		state.lastActiveMs = time.Now().UnixMilli()
	}
	uc.mu.Unlock()
}

func (uc *SyncUseCase) HandleSettingsUpdate(_ context.Context, sessionID string, update *rtmodel.SettingsUpdatePayload) error {
	if update == nil {
		return fmt.Errorf("settings_update is required")
	}
	dataType, ok := rtmodel.ParseSyncDataType(update.DataType)
	if !ok {
		return fmt.Errorf("invalid data_type")
	}

	uc.mu.Lock()
	state, exists := uc.sessions[sessionID]
	if !exists {
		uc.mu.Unlock()
		return fmt.Errorf("session not found")
	}
	userID := state.userID
	deviceID := state.deviceID
	now := time.Now().UnixMilli()

	uc.lastSyncAtMs[userID] = now
	if _, ok := uc.versions[userID]; !ok {
		uc.versions[userID] = make(map[syncv1.SyncDataType]int64)
	}
	uc.versions[userID][dataType]++
	version := uc.versions[userID][dataType]

	settingPayload := &rtmodel.SettingsSyncPayload{
		DataType:             dataType.String(),
		Version:              version,
		SourceDeviceID:       deviceID,
		UserSettings:         update.UserSettings,
		NotificationSettings: update.NotificationSettings,
		PrivacySettings:      update.PrivacySettings,
		ContentCategoryOrder: update.ContentCategoryOrder,
	}
	if _, ok := uc.latest[userID]; !ok {
		uc.latest[userID] = make(map[syncv1.SyncDataType]*rtmodel.SettingsSyncPayload)
	}
	uc.latest[userID][dataType] = settingPayload
	publisher := uc.publisher
	uc.mu.Unlock()

	if publisher == nil {
		return fmt.Errorf("realtime publisher is not configured")
	}
	channel := rtmodel.SettingEventChannel(userID, dataType)
	return publisher.Publish(channel, settingPayload)
}

func (uc *SyncUseCase) ForceSync(_ context.Context, userID string, types []syncv1.SyncDataType) (int, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return 0, fmt.Errorf("user_id is required")
	}

	targetTypes := normalizeSettingTypes(types)

	uc.mu.RLock()
	if len(uc.sessionsByUser[userID]) == 0 {
		uc.mu.RUnlock()
		return 0, nil
	}
	latestSnapshot := uc.latest[userID]
	versions := uc.versions[userID]
	publisher := uc.publisher
	uc.mu.RUnlock()

	if publisher == nil {
		return 0, fmt.Errorf("realtime publisher is not configured")
	}

	pushCount := 0
	for _, syncType := range targetTypes {
		payload := latestSnapshot[syncType]
		if payload == nil {
			payload = &rtmodel.SettingsSyncPayload{
				DataType:       syncType.String(),
				Version:        versions[syncType],
				SourceDeviceID: "server",
			}
		}
		if err := publisher.Publish(rtmodel.SettingEventChannel(userID, syncType), payload); err != nil {
			return pushCount, err
		}
		pushCount++
	}

	uc.mu.Lock()
	uc.lastSyncAtMs[userID] = time.Now().UnixMilli()
	uc.mu.Unlock()

	return pushCount, nil
}

func (uc *SyncUseCase) DisconnectDevice(_ context.Context, userID, deviceID string) int {
	userID = strings.TrimSpace(userID)
	deviceID = strings.TrimSpace(deviceID)
	if userID == "" || deviceID == "" {
		return 0
	}

	uc.mu.RLock()
	targets := make([]func(), 0)
	for _, session := range uc.sessionsByUser[userID] {
		if session.deviceID != deviceID || session.disconnectFn == nil {
			continue
		}
		targets = append(targets, session.disconnectFn)
	}
	uc.mu.RUnlock()

	closed := 0
	for _, disconnectFn := range targets {
		disconnectFn()
		closed++
	}
	return closed
}

func (uc *SyncUseCase) GetSyncStatus(userID string) *syncv1.SyncStatus {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return &syncv1.SyncStatus{}
	}

	uc.mu.RLock()
	defer uc.mu.RUnlock()

	devices := uc.buildActiveDevicesLocked(userID, "")
	dataVersions := map[string]int64{}
	for t, version := range uc.versions[userID] {
		dataVersions[t.String()] = version
	}
	return &syncv1.SyncStatus{
		UserId:        userID,
		ActiveDevices: devices,
		LastSyncAt:    uc.lastSyncAtMs[userID],
		DataVersions:  dataVersions,
	}
}

func (uc *SyncUseCase) GetActiveDevices(userID, currentDeviceID string) []*syncv1.ActiveDevice {
	userID = strings.TrimSpace(userID)
	uc.mu.RLock()
	defer uc.mu.RUnlock()
	return uc.buildActiveDevicesLocked(userID, currentDeviceID)
}

func (uc *SyncUseCase) buildActiveDevicesLocked(userID, currentDeviceID string) []*syncv1.ActiveDevice {
	sessions := uc.sessionsByUser[userID]
	result := make([]*syncv1.ActiveDevice, 0, len(sessions))
	for _, session := range sessions {
		result = append(result, &syncv1.ActiveDevice{
			DeviceId:     session.deviceID,
			DeviceName:   session.deviceID,
			Platform:     "web",
			ConnectedAt:  session.connectedAtMs,
			LastActiveAt: session.lastActiveMs,
			IsCurrent:    currentDeviceID != "" && session.deviceID == currentDeviceID,
		})
	}
	return result
}

func normalizeSettingTypes(types []syncv1.SyncDataType) []syncv1.SyncDataType {
	if len(types) == 0 {
		return []syncv1.SyncDataType{
			syncv1.SyncDataType_SYNC_DATA_TYPE_USER_SETTINGS,
			syncv1.SyncDataType_SYNC_DATA_TYPE_NOTIFICATION_SETTINGS,
			syncv1.SyncDataType_SYNC_DATA_TYPE_PRIVACY_SETTINGS,
			syncv1.SyncDataType_SYNC_DATA_TYPE_CONTENT_CATEGORY_ORDER,
		}
	}
	seen := make(map[syncv1.SyncDataType]struct{}, len(types))
	result := make([]syncv1.SyncDataType, 0, len(types))
	for _, t := range types {
		if t == syncv1.SyncDataType_SYNC_DATA_TYPE_UNSPECIFIED {
			continue
		}
		if _, exists := seen[t]; exists {
			continue
		}
		seen[t] = struct{}{}
		result = append(result, t)
	}
	return result
}
