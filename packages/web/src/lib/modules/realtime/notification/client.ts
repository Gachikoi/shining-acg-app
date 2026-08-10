import { LocalStorageKeys } from '$lib/constants';
import type { RealtimeNotificationEventPayload } from '../core';
import { centrifuge } from '../core';

const NOTIFICATION_CHANNEL_PREFIX = 'evt.notification.user.';

export interface NotificationRealtimeListener {
	onEvent?: (event: RealtimeNotificationEventPayload) => void;
}

export interface NotificationRealtimeClient {
	subscribe: (listener: NotificationRealtimeListener) => () => void;
	close: () => void;
}

const listeners = new Set<NotificationRealtimeListener>();
let activeChannel: string | undefined;

const ensureSubscribed = () => {
	if (!listeners.size) {
		return;
	}

	const userID = localStorage.getItem(LocalStorageKeys.USER_ID);
	if (!userID) {
		return;
	}
	const nextChannel = buildNotificationChannel(userID);
	if (activeChannel === nextChannel) {
		return;
	}
	if (activeChannel) {
		const activeSubscription = centrifuge.getSubscription(activeChannel);
		activeSubscription?.unsubscribe();
		centrifuge.removeSubscription(activeSubscription);
	}
	const subscription =
		centrifuge.getSubscription(nextChannel) ?? centrifuge.newSubscription(nextChannel);
	subscription.on('publication', (event) => {
		const data = parseNotificationPayload(event.data);
		if (!data) {
			return;
		}
		for (const listener of listeners) {
			listener.onEvent?.(data);
		}
	});
	subscription.subscribe();
	activeChannel = nextChannel;
};

centrifuge.on('connected', () => ensureSubscribed());

export const notificationClient: NotificationRealtimeClient = {
	subscribe: (listener: NotificationRealtimeListener) => {
		listeners.add(listener);
		centrifuge.connect();
		ensureSubscribed();
		return () => {
			listeners.delete(listener);
		};
	},
	close: () => {
		if (activeChannel) {
			const subscription = centrifuge.getSubscription(activeChannel);
			subscription?.unsubscribe();
			centrifuge.removeSubscription(subscription);
			activeChannel = undefined;
		}
		listeners.clear();
	}
};

function parseNotificationPayload(payload: unknown): RealtimeNotificationEventPayload | undefined {
	if (!payload || typeof payload !== 'object') {
		return undefined;
	}
	const data = payload as { notification_event?: unknown };
	if (data.notification_event && typeof data.notification_event === 'object') {
		return data.notification_event as RealtimeNotificationEventPayload;
	}
	return payload as RealtimeNotificationEventPayload;
}

function buildNotificationChannel(userID: string): string {
	return `${NOTIFICATION_CHANNEL_PREFIX}${userID}`;
}
