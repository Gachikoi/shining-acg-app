/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `cache-${version}`;

const ASSETS = [...build, ...files, '/'];

sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

sw.addEventListener('fetch', (event) => {
	// 只处理 GET 请求
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// 如果请求的文件在缓存中，直接返回缓存的响应
		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);
			if (response) {
				return response;
			}
		}

		// 如果请求的文件不在缓存中，尝试从网络获取
		try {
			const response = await fetch(event.request);

			// 如果我们离线，fetch 可能返回一个不是 Response 的值
			// 而不是抛出 - 我们不能将这个非 Response 传递给 respondWith
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			// 仅缓存 assets 中的文件
			if (response.status === 200 && ASSETS.includes(url.pathname)) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			// fall back to cache if available
			const response = await cache.match(event.request);
			if (response) return response;

			throw err;
		}
	}

	event.respondWith(respond());
});

sw.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});
