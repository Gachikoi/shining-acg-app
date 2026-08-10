import type { RealtimeBatchProgress } from '../core';
import { centrifuge } from '../core';

const MEDIA_CHANNEL_PREFIX = 'evt.media.batch.';

export interface MediaRealtimeListener {
	onProgress?: (progress: RealtimeBatchProgress) => void;
	onClose?: () => void;
}

export interface MediaRealtimeClient {
	subscribe: (listener: MediaRealtimeListener, batchIds?: string[]) => () => void;
	close: () => void;
}

const listenerBatchIds = new Map<MediaRealtimeListener, string[]>();

centrifuge.on('disconnected', () => {
	for (const listener of listenerBatchIds.keys()) {
		listener.onClose?.();
	}
});

centrifuge.on('connected', () => {
	const desiredBatchIds = new Set<string>();
	for (const batchIds of listenerBatchIds.values()) {
		for (const batchId of batchIds) {
			desiredBatchIds.add(batchId);
		}
	}

	for (const batchId of desiredBatchIds) {
		const channel = buildBatchChannel(batchId);
		let subscription = centrifuge.getSubscription(channel);
		if (!subscription) {
			subscription = centrifuge.newSubscription(channel);
			subscription.on('publication', (event) => {
				const progress = parseMediaProgress(event.data);
				if (!progress) {
					return;
				}
				for (const [listener, batchIds] of listenerBatchIds) {
					if (batchIds.includes(batchId)) {
						listener.onProgress?.(progress);
					}
				}
			});
			subscription.subscribe();
		} else if (subscription.state === 'unsubscribed') {
			subscription.subscribe();
		}
	}
});

export const mediaClient: MediaRealtimeClient = {
	subscribe: (listener: MediaRealtimeListener, batchIds: string[] = []) => {
		const nextBatchIds = normalizeBatchIds(batchIds);
		listenerBatchIds.set(listener, nextBatchIds);
		centrifuge.connect();

		for (const batchId of nextBatchIds) {
			const channel = buildBatchChannel(batchId);
			let subscription = centrifuge.getSubscription(channel);
			if (!subscription) {
				subscription = centrifuge.newSubscription(channel);
				subscription.on('publication', (event) => {
					const progress = parseMediaProgress(event.data);
					if (!progress) {
						return;
					}
					for (const [currentListener, currentBatchIds] of listenerBatchIds) {
						if (currentBatchIds.includes(batchId)) {
							currentListener.onProgress?.(progress);
						}
					}
				});
				subscription.subscribe();
			} else if (subscription.state === 'unsubscribed') {
				subscription.subscribe();
			}
		}

		return () => {
			const currentBatchIds = listenerBatchIds.get(listener) ?? [];
			listenerBatchIds.delete(listener);
			for (const batchId of currentBatchIds) {
				let stillNeeded = false;
				for (const currentBatchIds of listenerBatchIds.values()) {
					if (currentBatchIds.includes(batchId)) {
						stillNeeded = true;
						break;
					}
				}
				if (!stillNeeded) {
					const channel = buildBatchChannel(batchId);
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
			if (channel.startsWith(MEDIA_CHANNEL_PREFIX)) {
				const subscription = subscriptions[channel];
				subscription?.unsubscribe();
				centrifuge.removeSubscription(subscription);
			}
		}
		listenerBatchIds.clear();
	}
};

function parseMediaProgress(payload: unknown): RealtimeBatchProgress | undefined {
	if (!payload || typeof payload !== 'object') {
		return undefined;
	}
	const direct = payload as RealtimeBatchProgress;
	if (direct.batch_id || direct.stage) {
		return direct;
	}
	const data = payload as { progress?: unknown; media_progress?: { progress?: unknown } };
	const progress = data.progress ?? data.media_progress?.progress;
	if (!progress || typeof progress !== 'object') {
		return undefined;
	}
	return progress as RealtimeBatchProgress;
}

function buildBatchChannel(batchId: string): string {
	return `${MEDIA_CHANNEL_PREFIX}${normalizeSegment(batchId)}`;
}

function normalizeBatchIds(values: string[]): string[] {
	const set = new Set<string>();
	for (const value of values) {
		const normalized = normalizeSegment(value);
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
