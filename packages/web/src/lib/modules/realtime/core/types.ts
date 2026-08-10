import type {
	V1SyncDataType,
	V1SyncedContentCategoryOrder,
	V1SyncedNotificationSettings,
	V1SyncedPrivacySettings,
	V1SyncedUserSettings
} from '../../../api';

export interface RealtimeBatchProgress {
	batch_id?: string;
	stage?: string;
	message?: string;
	percent?: string;
	[key: string]: unknown;
}

export interface RealtimeSettingsUpdatePayload {
	data_type?: V1SyncDataType;
	device_id?: string;
	user_settings?: V1SyncedUserSettings;
	notification_settings?: V1SyncedNotificationSettings;
	privacy_settings?: V1SyncedPrivacySettings;
	content_category_order?: V1SyncedContentCategoryOrder;
}

export interface RealtimeSettingsSyncPayload {
	data_type?: V1SyncDataType;
	version?: string;
	source_device_id?: string;
	user_settings?: V1SyncedUserSettings;
	notification_settings?: V1SyncedNotificationSettings;
	privacy_settings?: V1SyncedPrivacySettings;
	content_category_order?: V1SyncedContentCategoryOrder;
}

export interface RealtimeNotificationEventPayload {
	event_type?: string;
	message?: string;
	[key: string]: unknown;
}

export interface RealtimeChatEventPayload {
	event_type?: string;
	message?: string;
	[key: string]: unknown;
}
