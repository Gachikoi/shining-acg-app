import { LocalStorageKeys } from '$lib/constants';

import type { V1SyncDataType } from '../../../api';
import type { RealtimeSettingsSyncPayload, RealtimeSettingsUpdatePayload } from '../core';
import { centrifuge } from '../core';

const RPC_METHOD_SYNC_SETTINGS_UPDATE =
	'/api.main.realtime.v1.RealtimeRpcService/SyncSettingsUpdate';

const SETTING_CHANNEL_PREFIX = 'evt.setting.user.';

export interface SettingRealtimeListener {
	onSettingsSync?: (message: RealtimeSettingsSyncPayload) => void;
}

export interface SettingRealtimeClient {
	subscribe: (listener: SettingRealtimeListener, types?: V1SyncDataType[]) => () => void;
	sendSettingsUpdate: (message: RealtimeSettingsUpdatePayload) => Promise<SettingUpdateRpcResponse>;
	close: () => void;
}

export type SettingUpdateRpcResponse = {
	success?: boolean;
	message?: string;
};

// 模块级状态
// 模块级状态：使用反向索引记录每个同步类型对应的监听器集合
// Map<SyncType, Set<Listener>>
const typeListeners = new Map<V1SyncDataType, Set<SettingRealtimeListener>>();

// 辅助：记录每个监听器订阅了哪些类型，方便清理
// Map<Listener, Set<SyncType>>
const listenerSubscriptions = new Map<SettingRealtimeListener, Set<V1SyncDataType>>();

// 核心逻辑：分发消息给关注该类型的监听器
const dispatchMessage = (type: V1SyncDataType, eventData: unknown) => {
	const listeners = typeListeners.get(type);
	if (!listeners || listeners.size === 0) {
		return;
	}

	const message = parseSettingPayload(eventData);
	if (!message) {
		return;
	}

	for (const listener of listeners) {
		listener.onSettingsSync?.(message);
	}
};

// 核心逻辑：确保指定类型的频道已订阅
const ensureSubscription = (userID: string, type: V1SyncDataType) => {
	const channel = buildSettingChannel(userID, type);
	let sub = centrifuge.getSubscription(channel);

	if (!sub) {
		sub = centrifuge.newSubscription(channel);
		sub.on('publication', (ctx) => dispatchMessage(type, ctx.data));
		sub.subscribe();
	} else if (sub.state === 'unsubscribed') {
		sub.subscribe();
	}
};

// 核心逻辑：清理不再需要的频道订阅
const cleanupSubscription = (userID: string, type: V1SyncDataType) => {
	const listeners = typeListeners.get(type);
	// 如果该类型已经没有任何监听器关注，则取消订阅
	if (!listeners || listeners.size === 0) {
		const channel = buildSettingChannel(userID, type);
		const sub = centrifuge.getSubscription(channel);
		if (sub) {
			sub.unsubscribe();
			centrifuge.removeSubscription(sub);
		}
		// 清理空的 Set
		typeListeners.delete(type);
	}
};

// 核心逻辑：刷新所有订阅（通常用于断线重连或初始登录）
const refreshSubscriptions = () => {
	const userID = window.localStorage.getItem(LocalStorageKeys.USER_ID);
	if (!userID) return;

	// 只需要遍历 typeListeners 的 keys 即可，因为那是所有需要的类型
	for (const type of typeListeners.keys()) {
		ensureSubscription(userID, type);
	}
};

export const settingClient: SettingRealtimeClient = {
	subscribe: (listener: SettingRealtimeListener, types: V1SyncDataType[] = []) => {
		// 1. 注册双向索引
		let currentTypes = listenerSubscriptions.get(listener);
		if (!currentTypes) {
			currentTypes = new Set();
			listenerSubscriptions.set(listener, currentTypes);
		}

		for (const type of types) {
			// 更新监听器 -> 类型
			currentTypes.add(type);

			// 更新类型 -> 监听器
			let listeners = typeListeners.get(type);
			if (!listeners) {
				listeners = new Set();
				typeListeners.set(type, listeners);
			}
			listeners.add(listener);
		}

		// 2. 尝试建立订阅
		const userID = window.localStorage.getItem(LocalStorageKeys.USER_ID);
		if (userID) {
			types.forEach((type) => ensureSubscription(userID, type));
		}

		// 3. 返回清理函数
		return () => {
			const subscribedTypes = listenerSubscriptions.get(listener);
			if (!subscribedTypes) {
				return;
			}
			listenerSubscriptions.delete(listener);

			const currentUserID = window.localStorage.getItem(LocalStorageKeys.USER_ID);

			for (const type of subscribedTypes) {
				// 从类型索引中移除该监听器
				const listeners = typeListeners.get(type);
				if (listeners) {
					listeners.delete(listener);
					// 如果已登录，检查是否需要取消订阅
					if (currentUserID) {
						cleanupSubscription(currentUserID, type);
					}
				}
			}
		};
	},

	sendSettingsUpdate: async (message: RealtimeSettingsUpdatePayload) => {
		centrifuge.connect();
		await centrifuge.ready();
		const result = await centrifuge.rpc(RPC_METHOD_SYNC_SETTINGS_UPDATE, message);
		const data = result.data as SettingUpdateRpcResponse;
		if (!data.success) {
			throw new Error(data.message || 'Unknown error');
		}
		return data;
	},

	close: () => {
		// 清理所有相关频道的订阅
		const subscriptions = centrifuge.subscriptions();
		for (const channel in subscriptions) {
			if (channel.startsWith(SETTING_CHANNEL_PREFIX)) {
				const sub = subscriptions[channel];
				sub?.unsubscribe();
				centrifuge.removeSubscription(sub);
			}
		}
		typeListeners.clear();
		listenerSubscriptions.clear();
	}
};

// 监听连接事件，确保断线重连后恢复所有必要的订阅
centrifuge.on('connected', refreshSubscriptions);

function parseSettingPayload(payload: unknown): RealtimeSettingsSyncPayload | undefined {
	if (!payload || typeof payload !== 'object') {
		return undefined;
	}
	const data = payload as { settings_sync?: unknown };
	if (data.settings_sync && typeof data.settings_sync === 'object') {
		return data.settings_sync as RealtimeSettingsSyncPayload;
	}
	return payload as RealtimeSettingsSyncPayload;
}

function buildSettingChannel(userID: string, syncType: V1SyncDataType): string {
	return `${SETTING_CHANNEL_PREFIX}${userID}.${syncType}`;
}
