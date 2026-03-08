/**
 * @file Feed 数据 Store（泛型函数式工厂模式）
 * @description
 * 每个分类（category）拥有独立的 FeedStore<T> 实例，管理该分类的数据生命周期：
 * 缓存读取 → 骨架屏/缓存展示 → API 请求 → 数据就绪
 *
 * 泛型 T 代表列表项数据类型（如 V1PostPreview、V1UserSummary），
 * 使同一 store 逻辑可服务于不同内容类型的 Feed 流。
 *
 * 使用 Svelte 5 runes（$state）在闭包内维护响应式状态，
 * 通过 getter 暴露只读的响应式接口，闭包天然封装了所有私有状态。
 */

import type { FeedPhase, FeedStoreConfig } from './types';

/**
 * 创建 per-category 的 Feed 数据 store
 *
 * @template T - 列表项数据类型（如 V1PostPreview、V1UserSummary）
 * @param categoryId - 分类 ID（如 'general', 'following', 'user'）
 * @param config - 配置项（缓存实例、请求函数、数据适配器等）
 * @returns FeedStore 实例，通过 getter 暴露响应式状态
 *
 * @example
 * ```typescript
 * // 帖子流
 * const postStore = createFeedStore<V1PostPreview>('general', {
 *   cache: feedCache,
 *   cacheAdapter: {
 *     extractItems: (r) => r.posts?.items,
 *     buildPayload: (items, cursor) => ({ posts: { items }, cursor }),
 *   },
 *   getItemId: (post) => post.postId,
 *   generateSkeleton: (n) => generatePosts(n, 0),
 *   fetchFn: async ({ categoryId, cursor, needNum }) => { ... },
 * });
 *
 * // 用户流
 * const userStore = createFeedStore<V1UserSummary>('user', {
 *   cache: feedCache,
 *   cacheAdapter: {
 *     extractItems: (r) => r.users?.items,
 *     buildPayload: (items, cursor) => ({ users: { items }, cursor }),
 *   },
 *   getItemId: (user) => user.userId,
 *   generateSkeleton: (n) => generateUserSkeletons(n),
 *   fetchFn: async ({ categoryId, cursor, needNum }) => { ... },
 * });
 * ```
 */
export function createFeedStore<T>(categoryId: string, config: FeedStoreConfig<T>) {
	// ─── 响应式状态（闭包私有，通过 getter 暴露） ──────────────────────

	/** 数据项列表 */
	let items = $state<T[]>([]);
	/** 数据生命周期阶段 */
	let phase = $state<FeedPhase>('idle');
	/** 分页游标 */
	let cursor = $state<string | null>(null);
	/** 是否还有更多数据可加载 */
	let hasMore = $state(true);
	/** 是否正在执行下拉刷新 */
	let refreshing = $state(false);
	/** 是否正在加载更多 */
	let loadingMore = $state(false);

	// ─── 非响应式私有状态 ────────────────────────────────────────────

	/** 已展示数据项 ID 去重集合 */
	const seenIds = new Set<string>();
	/** 竞态控制：当前最新请求的 ID，过时的响应会被丢弃 */
	let currentFetchId = 0;

	// ─── 内部辅助函数 ────────────────────────────────────────────────

	/**
	 * 对数据列表进行去重（基于 getItemId 提取的唯一 ID）
	 *
	 * @param newItems - 新获取的数据列表
	 * @returns 去重后的数据列表
	 */
	function dedup(newItems: T[]): T[] {
		const unique: T[] = [];
		for (const item of newItems) {
			const id = config.getItemId(item);
			if (id && !seenIds.has(id)) {
				seenIds.add(id);
				unique.push(item);
			}
		}
		return unique;
	}

	/**
	 * 将当前数据快照持久化到 IndexedDB
	 * 通过 cacheAdapter.buildPayload 将泛型数据转为 V1GetFeedResponse 格式
	 */
	async function persistToCache(): Promise<void> {
		try {
			const payload = config.cacheAdapter.buildPayload(
				$state.snapshot(items) as T[],
				cursor ?? undefined
			);
			await config.cache.set(categoryId, payload);
		} catch (error) {
			console.warn(`[FeedStore:${categoryId}] 缓存写入失败:`, error);
		}
	}

	// ─── 公开 API ────────────────────────────────────────────────────

	/**
	 * 初始化：从 IndexedDB 缓存加载数据，或生成骨架屏占位数据
	 *
	 * 仅在 phase === 'idle' 时执行，防止重复初始化。
	 * - 命中缓存 → phase = 'cache-hit'，立即展示缓存数据
	 * - 未命中 → phase = 'skeleton'，展示 mock 骨架屏占位
	 */
	async function init(): Promise<void> {
		if (phase !== 'idle') return;
		phase = 'cache-loading';

		try {
			const snapshot = await config.cache.get(categoryId);
			const cachedItems = snapshot ? config.cacheAdapter.extractItems(snapshot) : undefined;

			if (cachedItems && cachedItems.length > 0) {
				items = cachedItems;
				cursor = snapshot?.cursor ?? null;
				// 从缓存数据重建去重集合
				for (const item of cachedItems) {
					const id = config.getItemId(item);
					if (id) seenIds.add(id);
				}
				phase = 'cache-hit';
			} else {
				items = config.generateSkeleton(
					typeof config.needNum === 'function' ? config.needNum() : config.needNum
				);
				phase = 'skeleton';
			}
		} catch (error) {
			console.error(`[FeedStore:${categoryId}] 缓存加载失败:`, error);
			config.onError?.(error, 'init');
			items = config.generateSkeleton(
				typeof config.needNum === 'function' ? config.needNum() : config.needNum
			);
			phase = 'skeleton';
		}
	}

	/**
	 * 下拉刷新：清空当前数据，调用 API 获取最新数据
	 *
	 * 包含竞态控制（通过 fetchId 丢弃过时的响应）和防重入保护。
	 * 刷新前会清除 IndexedDB 缓存，防止失败时残留陈旧数据。
	 */
	async function refresh(): Promise<void> {
		if (refreshing) return;

		const fetchId = ++currentFetchId;
		refreshing = true;

		await config.cache.delete(categoryId);

		try {
			const result = await config.fetchFn({
				categoryId,
				cursor: undefined,
				isRefresh: true,
				needNum: typeof config.needNum === 'function' ? config.needNum() : config.needNum
			});

			if (fetchId !== currentFetchId) return;

			seenIds.clear();
			items = dedup(result.items);
			cursor = result.cursor;
			hasMore = result.hasMore;
			phase = 'ready';

			await persistToCache();
		} catch (error) {
			if (fetchId !== currentFetchId) return;
			console.error(`[FeedStore:${categoryId}] 刷新失败:`, error);
			config.onError?.(error, 'refresh');
			if (phase === 'skeleton') phase = 'error';
		} finally {
			if (fetchId === currentFetchId) {
				refreshing = false;
			}
		}
	}

	/**
	 * 加载更多：基于 cursor 分页加载，追加到现有数据末尾
	 *
	 * 包含防重入保护和竞态控制。
	 * 骨架屏阶段不允许加载更多（此时没有真实数据可追加）。
	 */
	async function loadMore(): Promise<void> {
		if (loadingMore || !hasMore || phase === 'skeleton') return;

		const fetchId = ++currentFetchId;
		loadingMore = true;

		try {
			const result = await config.fetchFn({
				categoryId,
				cursor: cursor ?? undefined,
				isRefresh: false,
				needNum: typeof config.needNum === 'function' ? config.needNum() : config.needNum
			});

			if (fetchId !== currentFetchId) return;

			const uniqueItems = dedup(result.items);
			if (uniqueItems.length > 0) {
				items = [...items, ...uniqueItems];
			}

			cursor = result.cursor;
			hasMore = result.hasMore;
			if (phase !== 'ready') phase = 'ready';

			await persistToCache();
		} catch (error) {
			if (fetchId !== currentFetchId) return;
			console.error(`[FeedStore:${categoryId}] 加载更多失败:`, error);
			config.onError?.(error, 'loadMore');
		} finally {
			if (fetchId === currentFetchId) {
				loadingMore = false;
			}
		}
	}

	/**
	 * 重置为初始状态（idle），清空所有数据
	 * 通常在分类切换或页面卸载时调用
	 */
	function reset(): void {
		items = [];
		phase = 'idle';
		cursor = null;
		hasMore = true;
		refreshing = false;
		loadingMore = false;
		seenIds.clear();
		currentFetchId++;
	}

	/**
	 * 销毁 store：递增 fetchId 使所有进行中的请求失效
	 */
	function destroy(): void {
		currentFetchId++;
	}

	// ─── 返回值：通过 getter 暴露响应式状态 ─────────────────────────

	return {
		/** 数据项列表（响应式） */
		get items() {
			return items;
		},
		/** 数据生命周期阶段（响应式） */
		get phase() {
			return phase;
		},
		/** 分页游标（响应式） */
		get cursor() {
			return cursor;
		},
		/** 是否还有更多数据（响应式） */
		get hasMore() {
			return hasMore;
		},
		/** 是否正在下拉刷新（响应式） */
		get refreshing() {
			return refreshing;
		},
		/** 是否正在加载更多（响应式） */
		get loadingMore() {
			return loadingMore;
		},
		/**
		 * 是否应显示骨架屏（响应式派生状态）
		 * 当处于 skeleton 阶段时为 true
		 */
		get showSkeleton() {
			return phase === 'skeleton';
		},
		/** 该 store 绑定的分类 ID */
		get categoryId() {
			return categoryId;
		},
		init,
		refresh,
		loadMore,
		reset,
		destroy
	};
}

/** FeedStore 实例类型（泛型，从工厂函数返回值推导） */
export type FeedStore<T = unknown> = ReturnType<typeof createFeedStore<T>>;
