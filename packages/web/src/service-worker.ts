/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';
import { createConcurrencyLimiter } from './lib/utils';

const sw = self as unknown as ServiceWorkerGlobalScope;

const SOURCE_CODE_CACHE = `source-code/${version}` as const;
let mediaCategories: Set<string> = new Set(['feed/general', 'feed/following', 'feed/user']); // TODO处理初态

const SOURCE_CODE_ASSETS = [...build, ...files, '/'];

const taskQueue = createConcurrencyLimiter(20);

sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(SOURCE_CODE_CACHE);
		await cache.addAll(SOURCE_CODE_ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		// 应用更新后，多媒体缓存消失（TODO，保留多媒体缓存）
		for (const key of await caches.keys()) {
			if (key !== SOURCE_CODE_CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

sw.addEventListener('fetch', (event) => {
	// 只处理 GET 请求
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	const targetCache = (() => {
		if (SOURCE_CODE_ASSETS.includes(url.pathname)) return SOURCE_CODE_CACHE;
		if (mediaCategories?.has(url.searchParams.get('cache-category') || ''))
			return url.searchParams.get('cache-category') || '';
		return undefined;
	})();

	// 放行不需要缓存的请求
	if (!targetCache) {
		return;
	}

	async function respond() {
		if (!targetCache) return await fetch(event.request);

		const cache = await caches.open(targetCache);

		// 命中缓存则直接返回
		const cachedResponse = await cache.match(event.request);
		if (cachedResponse) return cachedResponse;

		// 区分源码资源和媒体资源——媒体资源需要特殊的跨域处理
		const isMediaCache = targetCache !== SOURCE_CODE_CACHE;

		try {
			let response: Response;

			if (isMediaCache) {
				// ── 媒体资源：升级为 CORS 模式获取透明响应 ──
				// <img> 标签默认 no-cors，跨域响应是 opaque（status 0），无法做 status 200 校验。
				// 升级为 cors 后，即使经过 302 重定向（如 picsum.photos → fastly.picsum.photos），
				// 也能拿到最终 status 200 的透明响应，可靠地写入 Cache Storage。
				// cache key 始终是原始 URL（含 cache-category 标记），与重定向目标无关。
				try {
					response = await fetch(event.request.url, {
						mode: 'cors',
						credentials: 'omit'
					});
				} catch {
					// CORS 不可用（服务端未配置 Access-Control-Allow-Origin），
					// 降级为原始 no-cors 请求，得到 opaque 响应
					response = await fetch(event.request);
				}
			} else {
				response = await fetch(event.request);
			}

			// 如果我们离线，fetch 可能返回一个不是 Response 的值
			// 而不是抛出 - 我们不能将这个非 Response 传递给 respondWith
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			// 透明响应（CORS 成功 / 同源）：检查 status 200 后缓存
			if (response.status === 200) {
				const clonedResponse = response.clone();
				taskQueue.run(() => cache.put(event.request, clonedResponse));
			}
			// opaque 响应（CORS 降级）：无法读取 status，但仍可写入 Cache Storage
			// 权衡：opaque 响应有浏览器存储 padding（约 7MB），但能保证离线可用
			else if (isMediaCache && response.type === 'opaque') {
				const clonedResponse = response.clone();
				taskQueue.run(() => cache.put(event.request, clonedResponse));
			}

			return response;
		} catch (err) {
			// 网络完全不可用，兜底从缓存返回
			const fallback = await cache.match(event.request);
			if (fallback) return fallback;
			throw err;
		}
	}

	event.respondWith(respond());
});

sw.addEventListener('message', async (event) => {
	if (!event.data) return;

	switch (event.data.type) {
		case 'SKIP_WAITING':
			sw.skipWaiting();
			return;
		case 'GET_MEDIA_CACHE_CATEGORIES':
			mediaCategories = new Set(event.data.data.mediaCategories);
			return;
	}
});
