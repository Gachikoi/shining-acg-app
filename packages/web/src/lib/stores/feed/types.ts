/**
 * @file Feed 数据管理模块类型定义
 * @description
 * 定义 Feed 数据生命周期状态机、请求函数类型和配置接口。
 * 所有类型均为泛型，T 代表列表项数据类型（如 V1PostPreview、V1UserSummary）。
 */

import type { V1GetFeedResponse } from '$lib/api/types.gen';
import type { DbCache } from '$lib/modules/cache/db';

/**
 * Feed 数据生命周期阶段
 *
 * 状态转换图：
 * ```
 * idle → cache-loading → cache-hit   → ready
 *                      → skeleton    → ready
 *                                    → error
 * ```
 *
 * - `idle`: 未初始化，store 刚创建
 * - `cache-loading`: 正在读取 IndexedDB 缓存
 * - `cache-hit`: 命中缓存，显示缓存数据（后续可下拉刷新获取最新）
 * - `skeleton`: 未命中缓存，显示骨架屏占位数据
 * - `ready`: API 数据就绪，显示真实数据
 * - `error`: 请求失败
 */
export type FeedPhase = 'idle' | 'cache-loading' | 'cache-hit' | 'skeleton' | 'ready' | 'error';

/**
 * Feed API 请求的标准化结果
 *
 * @template T - 列表项数据类型
 */
export interface FeedFetchResult<T> {
	/** 数据项列表 */
	items: T[];
	/** 分页游标，null 表示没有更多数据 */
	cursor: string | null;
	/** 是否还有更多数据可加载 */
	hasMore: boolean;
}

/**
 * Feed 数据请求函数类型
 *
 * 由调用方（页面组件）提供，封装了具体的 API 调用逻辑和查询参数构建。
 * FeedStore 不关心请求细节，只关心标准化的返回结果。
 *
 * @template T - 列表项数据类型
 * @param params - 请求参数
 * @returns 标准化的请求结果
 */
export type FeedFetchFn<T> = (params: {
	/** 分类 ID */
	categoryId: string;
	/** 分页游标，刷新时为 undefined */
	cursor: string | undefined;
	/** 是否为刷新操作（true = 下拉刷新，false = 加载更多） */
	isRefresh: boolean;
	/** 每页请求数量 */
	needNum: number;
}) => Promise<FeedFetchResult<T>>;

/**
 * 缓存数据存取适配器
 *
 * 由于 V1GetFeedResponse 是一个多态响应（posts / users / following_authors），
 * 不同内容类型的 FeedStore 需要知道如何从缓存中读写对应字段。
 * 此接口将这些映射逻辑从 FeedStore 中解耦出来，由调用方注入。
 *
 * @template T - 列表项数据类型
 */
export interface FeedCacheAdapter<T> {
	/**
	 * 从 V1GetFeedResponse 中提取本内容类型的数据项
	 *
	 * @param response - 缓存中读出的原始响应
	 * @returns 数据项数组，无数据时返回 undefined
	 *
	 * @example
	 * // 帖子流
	 * extractItems: (r) => r.posts?.items
	 * // 用户流
	 * extractItems: (r) => r.users?.items
	 */
	extractItems: (response: Partial<V1GetFeedResponse>) => T[] | undefined;

	/**
	 * 将数据项列表封装为 V1GetFeedResponse 格式以写入缓存
	 *
	 * @param items - 当前数据项列表
	 * @param cursor - 当前分页游标
	 * @returns 可存入缓存的响应对象
	 *
	 * @example
	 * // 帖子流
	 * buildPayload: (items, cursor) => ({ posts: { items }, cursor })
	 * // 用户流
	 * buildPayload: (items, cursor) => ({ users: { items }, cursor })
	 */
	buildPayload: (items: T[], cursor?: string) => Partial<V1GetFeedResponse>;
}

/**
 * createFeedStore 工厂函数的配置项
 *
 * @template T - 列表项数据类型
 */
export interface FeedStoreConfig<T> {
	/**
	 * 每页请求数量
	 *
	 * - `number`：固定值
	 * - `() => number`：动态计算（每次 API 调用时执行，典型场景：根据容器尺寸估算）
	 *
	 * 动态函数返回 0 或负数时，退回默认值 20。
	 * 不传时默认 20。
	 */
	needNum: number | (() => number);

	/** IndexedDB 缓存实例，用于持久化 Feed 数据快照 */
	cache: DbCache<Partial<V1GetFeedResponse>>;

	/**
	 * 缓存数据存取适配器
	 * 定义如何从 V1GetFeedResponse 中读取/写入本内容类型的数据
	 */
	cacheAdapter: FeedCacheAdapter<T>;

	/** API 请求函数，由调用方注入 */
	fetchFn: FeedFetchFn<T>;

	/**
	 * 从数据项中提取唯一标识（用于去重）
	 * 返回 undefined 的项会被跳过（不参与去重，也不展示）
	 *
	 * @param item - 数据项
	 * @returns 唯一标识字符串
	 *
	 * @example
	 * // 帖子
	 * getItemId: (post) => post.postId
	 * // 用户
	 * getItemId: (user) => user.userId
	 */
	getItemId: (item: T) => string | undefined;

	/**
	 * 生成骨架屏占位数据
	 * 当 IndexedDB 无缓存时，调用此函数生成 mock 数据供组件渲染骨架屏
	 *
	 * @param count - 需要生成的数量
	 * @returns 占位数据列表
	 */
	generateSkeleton: (count: number) => T[];

	/**
	 * 错误处理回调（可选）
	 *
	 * @param error - 错误对象
	 * @param context - 错误发生的上下文
	 */
	onError?: (error: unknown, context: 'init' | 'refresh' | 'loadMore') => void;
}
