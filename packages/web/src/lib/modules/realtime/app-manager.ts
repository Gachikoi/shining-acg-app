import type { V1SyncDataType } from '$lib/api';

import { centrifuge } from './core';
import { notificationClient } from './notification';
import { settingClient } from './setting';

const DEFAULT_SYNC_TYPES: V1SyncDataType[] = [
	'SYNC_DATA_TYPE_USER_SETTINGS',
	'SYNC_DATA_TYPE_NOTIFICATION_SETTINGS',
	'SYNC_DATA_TYPE_PRIVACY_SETTINGS',
	'SYNC_DATA_TYPE_CONTENT_CATEGORY_ORDER'
];

type ManagerState = {
	started: boolean;
	unsubscribeNotification: (() => void) | null;
};

const managerState: ManagerState = {
	started: false,
	unsubscribeNotification: null
};

export function startRealtimeAppManager(): void {
	if (managerState.started) {
		return;
	}

	centrifuge.connect();
	const unsubscribeNotification = notificationClient.subscribe({});

	settingClient.subscribe({}, DEFAULT_SYNC_TYPES);

	managerState.unsubscribeNotification = unsubscribeNotification;
	managerState.started = true;
}

export function stopRealtimeAppManager(): void {
	if (!managerState.started) {
		return;
	}

	settingClient.close();
	managerState.unsubscribeNotification?.();
	notificationClient.close();

	managerState.unsubscribeNotification = null;
	managerState.started = false;

	// 登录退出或切换账号时由 manager 统一断开全局单例连接。
	centrifuge.disconnect();
}
