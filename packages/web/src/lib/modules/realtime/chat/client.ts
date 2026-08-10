import { centrifuge } from '../core';
import type { RealtimeChatEventPayload } from '../core';

const CHAT_CHANNEL_PREFIX = 'evt.chat.room.';

export interface ChatRealtimeListener {
	onEvent?: (event: RealtimeChatEventPayload) => void;
}

export interface ChatRealtimeClient {
	subscribe: (listener: ChatRealtimeListener, roomIds?: string[]) => () => void;
	close: () => void;
}

const listenerRoomIds = new Map<ChatRealtimeListener, string[]>();

const onConnected = () => {
	const desiredRoomIds = new Set<string>();
	for (const roomIds of listenerRoomIds.values()) {
		for (const roomId of roomIds) {
			desiredRoomIds.add(roomId);
		}
	}

	for (const roomId of desiredRoomIds) {
		const channel = buildRoomChannel(roomId);
		let subscription = centrifuge.getSubscription(channel);
		if (!subscription) {
			subscription = centrifuge.newSubscription(channel);
			subscription.on('publication', (event) => {
				const data = parseChatPayload(event.data);
				if (!data) {
					return;
				}
				for (const [listener, roomIds] of listenerRoomIds) {
					if (roomIds.includes(roomId)) {
						listener.onEvent?.(data);
					}
				}
			});
			subscription.subscribe();
		} else if (subscription.state === 'unsubscribed') {
			subscription.subscribe();
		}
	}
};
centrifuge.on('connected', onConnected);

export const chatClient: ChatRealtimeClient = {
	subscribe: (listener: ChatRealtimeListener, roomIds: string[] = []) => {
		const nextRoomIds = normalizeChannels(roomIds);
		listenerRoomIds.set(listener, nextRoomIds);
		centrifuge.connect();

		for (const roomId of nextRoomIds) {
			const channel = buildRoomChannel(roomId);
			let subscription = centrifuge.getSubscription(channel);
			if (!subscription) {
				subscription = centrifuge.newSubscription(channel);
				subscription.on('publication', (event) => {
					const data = parseChatPayload(event.data);
					if (!data) {
						return;
					}
					for (const [currentListener, currentRoomIds] of listenerRoomIds) {
						if (currentRoomIds.includes(roomId)) {
							currentListener.onEvent?.(data);
						}
					}
				});
				subscription.subscribe();
			} else if (subscription.state === 'unsubscribed') {
				subscription.subscribe();
			}
		}

		return () => {
			const currentRoomIds = listenerRoomIds.get(listener) ?? [];
			listenerRoomIds.delete(listener);
			for (const roomId of currentRoomIds) {
				let stillNeeded = false;
				for (const currentRoomIds of listenerRoomIds.values()) {
					if (currentRoomIds.includes(roomId)) {
						stillNeeded = true;
						break;
					}
				}
				if (!stillNeeded) {
					const channel = buildRoomChannel(roomId);
					const subscription = centrifuge.getSubscription(channel);
					if (subscription) {
						subscription.unsubscribe();
						centrifuge.removeSubscription(subscription);
					}
				}
			}
		};
	},
	close: () => {
		const subscriptions = centrifuge.subscriptions();
		for (const channel in subscriptions) {
			if (channel.startsWith(CHAT_CHANNEL_PREFIX)) {
				const subscription = subscriptions[channel];
				subscription?.unsubscribe();
				centrifuge.removeSubscription(subscription);
			}
		}
		listenerRoomIds.clear();
	}
};

function parseChatPayload(payload: unknown): RealtimeChatEventPayload | undefined {
	if (!payload || typeof payload !== 'object') {
		return undefined;
	}
	const data = payload as { chat_event?: unknown };
	if (data.chat_event && typeof data.chat_event === 'object') {
		return data.chat_event as RealtimeChatEventPayload;
	}
	return payload as RealtimeChatEventPayload;
}

function buildRoomChannel(roomId: string): string {
	return `${CHAT_CHANNEL_PREFIX}${normalizeSegment(roomId)}`;
}

function normalizeChannels(roomIds: string[]): string[] {
	const set = new Set<string>();
	for (const roomId of roomIds) {
		const normalized = normalizeSegment(roomId);
		if (!normalized) {
			continue;
		}
		set.add(normalized);
	}
	return Array.from(set);
}

function normalizeSegment(value: string): string {
	return value.trim().replaceAll(' ', '_');
}
