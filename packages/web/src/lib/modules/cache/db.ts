/**
 * @file db-cache/index.ts
 * @description 基于 IndexedDB 的通用持久化缓存模块。
 *
 * 本模块是对 `idb-keyval` 的业务无关封装，提供：
 * - 命名空间隔离：每个业务创建独立的 IDB Store，互不干扰
 * - TTL 过期机制：可精确控制每条缓存的生命周期
 * - 完整的 TypeScript 泛型支持
 * - 统一的 SSR 安全处理（在非浏览器环境下优雅降级）
 *
 * @example
 * // 1. 创建一个 feed 业务的缓存实例（TTL 默认 5 分钟）
 * const feedCache = createDbCache<FeedSnapshot>('feed', { defaultTtl: 5 * 60 * 1000 });
 *
 * // 2. 写入缓存（key = 分类名，如 'general'）
 * await feedCache.set('general', { posts: [...], cursor: 'xxx' });
 *
 * // 3. 读取缓存（过期则返回 null）
 * const snapshot = await feedCache.get('general');
 *
 * // 4. 删除单条
 * await feedCache.delete('general');
 *
 * // 5. 清空当前命名空间的所有缓存
 * await feedCache.clear();
 */
// TODO 后续根据需要替换为更细粒度的 indexeddb 库
import { createStore, del, get, keys, set } from 'idb-keyval';

// ─── 类型定义 ────────────────────────────────────────────────────────────────

/**
 * 存储在 IndexedDB 中的缓存条目结构。
 *
 * @template T 业务数据类型
 */
interface CacheEntry<T> {
	/** 业务数据本体 */
	data: T;
	/** 写入时的 Unix 时间戳（毫秒） */
	timestamp: number;
	/**
	 * 该条目的有效期（毫秒）。
	 * `undefined` 表示永不过期。
	 */
	ttl?: number;
}

/**
 * 创建 `DbCache` 实例时的配置选项。
 */
export interface DbCacheOptions {
	/**
	 * 该缓存实例中所有条目的默认 TTL（毫秒）。
	 * 调用 `set()` 时若未指定 `ttl`，则使用此默认值。
	 * `undefined` 表示默认永不过期。
	 *
	 * @default undefined
	 */
	defaultTtl?: number;

	/**
	 * IndexedDB 数据库名称。
	 * 不同命名空间会共用同一个数据库，通过 storeName 区分。
	 *
	 * @default 'shining-app-cache'
	 */
	dbName?: string;
}

// ─── DbCache 类 ──────────────────────────────────────────────────────────────

/**
 * 通用 IndexedDB 缓存类。
 *
 * 每个实例绑定一个命名空间（即一个独立的 IDB ObjectStore），
 * 用于隔离不同业务模块的缓存数据。
 *
 * @template T 业务数据类型
 */
export class DbCache<T = unknown> {
	/** idb-keyval 自定义 store 实例，绑定到特定的 DB + Store */
	private readonly store: ReturnType<typeof createStore> | null;
	/** 该实例的默认 TTL */
	private readonly defaultTtl?: number;

	/**
	 * @param namespace 命名空间，对应 IDB ObjectStore 的名称（建议使用横线分隔，如 `feed-general`）
	 * @param options 配置选项
	 */
	constructor(namespace: string, options?: DbCacheOptions) {
		this.defaultTtl = options?.defaultTtl;

		// SSR / 非浏览器环境安全保护：避免在 Node.js / Deno 环境中报错
		if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
			this.store = null;
			return;
		}

		const dbName = options?.dbName ?? 'shining-app-cache';
		// 每个命名空间使用独立的 ObjectStore，实现数据隔离
		this.store = createStore(dbName, namespace);
	}

	/**
	 * 读取缓存条目。
	 *
	 * 若条目不存在或已过期，返回 `null`；同时会异步删除已过期的条目（懒删除）。
	 *
	 * @param key 缓存键
	 * @returns 业务数据，或 `null`（未命中 / 已过期）
	 */
	async get(key: string): Promise<T | null> {
		if (!this.store) return null;

		try {
			const entry = await get<CacheEntry<T>>(key, this.store);

			if (!entry) return null;

			// 检查 TTL 是否已过期
			if (entry.ttl !== undefined) {
				const isExpired = Date.now() - entry.timestamp > entry.ttl;
				if (isExpired) {
					// 懒删除：异步清理过期条目，不阻塞返回
					del(key, this.store).catch(() => {});
					return null;
				}
			}

			return entry.data;
		} catch (error) {
			console.warn(`[DbCache] 读取缓存失败 (key="${key}"):`, error);
			return null;
		}
	}

	/**
	 * 写入缓存条目。
	 *
	 * @param key 缓存键
	 * @param data 业务数据
	 * @param ttl 该条目的有效期（毫秒），覆盖实例默认值；传 `undefined` 使用默认值
	 */
	async set(key: string, data: T, ttl?: number): Promise<void> {
		if (!this.store) return;

		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl: ttl ?? this.defaultTtl
		};

		try {
			await set(key, entry, this.store);
		} catch (error) {
			console.warn(`[DbCache] 写入缓存失败 (key="${key}"):`, error);
		}
	}

	/**
	 * 删除指定缓存条目。
	 *
	 * @param key 缓存键
	 */
	async delete(key: string): Promise<void> {
		if (!this.store) return;

		try {
			await del(key, this.store);
		} catch (error) {
			console.warn(`[DbCache] 删除缓存失败 (key="${key}"):`, error);
		}
	}

	/**
	 * 清空当前命名空间内的所有缓存条目。
	 *
	 * 注意：此操作只清空本命名空间的 ObjectStore，不影响其他命名空间。
	 */
	async clear(): Promise<void> {
		if (!this.store) return;

		try {
			// idb-keyval 不直接提供 clearStore，通过 keys + del 批量删除
			const allKeys = await keys<string>(this.store);
			await Promise.all(allKeys.map((k) => del(k, this.store!)));
		} catch (error) {
			console.warn(`[DbCache] 清空缓存失败:`, error);
		}
	}

	/**
	 * 检查指定键是否存在且未过期。
	 *
	 * @param key 缓存键
	 * @returns `true` 表示缓存有效
	 */
	async has(key: string): Promise<boolean> {
		const data = await this.get(key);
		return data !== null;
	}
}

/**
 * 创建一个类型安全的 `DbCache` 实例（工厂函数）。
 *
 * 推荐通过此函数创建缓存实例，而不是直接 `new DbCache()`。
 *
 * @template T 业务数据类型
 * @param namespace 命名空间（对应 IDB ObjectStore 名称）
 * @param options 配置选项
 * @returns DbCache 实例
 */
export function createDbCache<T>(namespace: string, options?: DbCacheOptions): DbCache<T> {
	return new DbCache<T>(namespace, options);
}
