import { DOMAIN_CONFIG, LocalStorageKeys } from '$lib/constants';
import { Centrifuge } from 'centrifuge';

const WS_URL = `wss://${DOMAIN_CONFIG.api}/v1/realtime/ws`;

export const centrifuge = new Centrifuge(
	buildRealtimeWsUrl(WS_URL, {
		token: localStorage.getItem(LocalStorageKeys.TOKEN) || undefined,
		deviceId: localStorage.getItem(LocalStorageKeys.DEVICE_ID) || undefined
	})
);

function buildRealtimeWsUrl(
	path: string,
	params: {
		token?: string;
		deviceId?: string;
	}
): string {
	const url = new URL(path);
	if (params.token) {
		url.searchParams.set('token', params.token);
	}
	if (params.deviceId) {
		url.searchParams.set('device_id', params.deviceId);
	}
	return url.toString();
}
