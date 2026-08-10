/**
 * @file Feed API 适配层
 * @description
 * 封装 Feed 流的 API 请求逻辑和缓存适配器。
 * 将查询参数构建、响应解析等与具体 API 耦合的逻辑从页面组件中解耦。
 *
 * 筛选状态（keyword、orderType 等）通过 V1FeedFilter getter 注入，
 * 使本模块不依赖任何 UI 框架的响应式系统。
 */

import type {
	FeedServiceGetFeedData,
	V1FeedFilter,
	V1PostPreview,
	V1UserSummary
} from '$lib/api/types.gen';
import { calculateLayoutBase } from '$lib/components/custom/waterfall/waterfall-container/waterfall-layout';
import { generatePosts, generateUsers, mockFetchFeed } from '$lib/test/waterfall-data-mock';
// import { feedServiceGetFeed } from '$lib/api/sdk.gen';
import type { FeedCacheAdapter, FeedFetchFn } from './types';

// ─── 缓存适配器 ──────────────────────────────────────────────────

/** 帖子流缓存适配器：读写 response.posts.items */
export const POST_CACHE_ADAPTER: FeedCacheAdapter<V1PostPreview> = {
	extractItems: (r) => r.posts?.items,
	buildPayload: (items, cursor) => ({ posts: { items }, cursor })
};

/** 用户流缓存适配器：读写 response.users.items */
export const USER_CACHE_ADAPTER: FeedCacheAdapter<V1UserSummary> = {
	extractItems: (r) => r.users?.items,
	buildPayload: (items, cursor) => ({ users: { items }, cursor })
};

// ─── 查询参数构建 ────────────────────────────────────────────────

/**
 * 构建 Feed API 通用查询参数
 * 返回类型安全的 FeedServiceGetFeedData['query']，无需手写 key
 *
 * @param categoryId - 分类 ID
 * @param cursor - 分页游标
 * @param isRefresh - 是否为刷新
 * @param needNum - 每页数量
 * @param filters - 筛选上下文（V1FeedFilter）
 * @returns 类型安全的查询参数对象
 */
export function buildFeedQueryParams(
	categoryId: string,
	cursor: string | undefined,
	isRefresh: boolean,
	needNum: number,
	filters: V1FeedFilter
): FeedServiceGetFeedData['query'] {
	const params: FeedServiceGetFeedData['query'] = {
		'pagination.cursor': cursor,
		'pagination.needNum': needNum,
		refreshType: isRefresh ? 'REFRESH_TYPE_PULL_DOWN' : 'REFRESH_TYPE_PULL_UP',
		categoryId
	};

	const { keyword, orderType, timeRange, authorId } = filters;

	if (categoryId === 'following') {
		if (authorId) params['filter.authorId'] = authorId;
	} else if (['self_post', 'self_like', 'self_collect'].includes(categoryId)) {
		if (keyword) params['filter.keyword'] = keyword;
	} else {
		if (keyword) params['filter.keyword'] = keyword;
		if (orderType) params['filter.orderType'] = orderType;
		if (timeRange?.startTimestamp) {
			params['filter.timeRange.startTimestamp'] = timeRange.startTimestamp;
		}
		if (timeRange?.endTimestamp) {
			params['filter.timeRange.endTimestamp'] = timeRange.endTimestamp;
		}
	}

	return params;
}

// ─── Fetch 工厂函数 ──────────────────────────────────────────────

/**
 * 创建帖子流 API 请求函数
 * 闭包捕获 getFilters getter，每次调用时读取最新筛选状态
 *
 * @param getFilters - 筛选上下文 getter（读取页面级响应式状态）
 * @returns FeedFetchFn<V1PostPreview>
 */
export function createPostFetchFn(getFilters: () => V1FeedFilter): FeedFetchFn<V1PostPreview> {
	return async ({ categoryId, cursor, isRefresh, needNum }) => {
		const queryParams = buildFeedQueryParams(categoryId, cursor, isRefresh, needNum, getFilters());

		// 单元测试 API（后端完成后替换为 feedServiceGetFeed）
		const response = await mockFetchFeed({
			query: queryParams,
			url: '/v1/feed'
		});
		// const response = await feedServiceGetFeed({ query: queryParams });

		const newItems = (response.data?.posts?.items || []) as V1PostPreview[];
		const newCursor = response.data?.cursor || null;
		const hasMoreData = newItems.length >= needNum && !(newCursor && parseInt(newCursor) > 200);

		return { items: newItems, cursor: newCursor, hasMore: hasMoreData };
	};
}

/**
 * 创建用户流 API 请求函数
 * 当前为 mock 占位，后端完成后替换为真实 API
 *
 * @param _getFilters - 筛选上下文 getter（预留，用户流暂不需要筛选）
 * @returns FeedFetchFn<V1UserSummary>
 */
export function createUserFetchFn(_getFilters?: () => V1FeedFilter): FeedFetchFn<V1UserSummary> {
	return async ({ cursor, needNum }) => {
		// TODO: 后端完成后替换为真实 API
		// const response = await feedServiceGetFeed({ query: queryParams });
		// return { items: response.data?.users?.items || [], cursor: ..., hasMore: ... };

		await new Promise((resolve) => setTimeout(resolve, 500));
		const offset = cursor ? parseInt(cursor) : 0;
		const newItems = generateUsers(needNum);
		const newCursor = (offset + needNum).toString();
		const hasMoreData = offset + needNum < 200;
		_getFilters?.();
		return { items: newItems, cursor: newCursor, hasMore: hasMoreData };
	};
}

// ─── Store 配置工厂 ──────────────────────────────────────────────

/**
 * 帖子流的 getItemId 提取器
 *
 * @param post - 帖子数据
 * @returns 帖子 ID
 */
export const getPostId = (post: V1PostPreview): string | undefined => post.postId;

/**
 * 用户流的 getItemId 提取器
 *
 * @param user - 用户数据
 * @returns 用户 ID
 */
export const getUserId = (user: V1UserSummary): string | undefined => user.userId;

/**
 * 帖子流骨架屏数据生成器
 *
 * @param count - 生成数量
 * @returns 帖子占位数据
 */
export const generatePostSkeletons = (count: number): V1PostPreview[] => generatePosts(count);

/**
 * 用户流骨架屏数据生成器
 *
 * @param count - 生成数量
 * @returns 用户占位数据
 */
export const generateUserSkeletons = (count: number): V1UserSummary[] => generateUsers(count);

// ─── 首屏数据量估算 ──────────────────────────────────────────────

/** estimateNeedNum 的参数 */
export interface EstimateNeedNumParams {
	/** 容器可用宽度（px） */
	containerWidth: number;
	/** 容器可用高度（px）——即滚动视口高度 */
	containerHeight: number;
	/** 最小单项宽度（px） */
	minItemWidth: number;
	/** 卡片间距（px）；默认 8 */
	gap: number;
	/**
	 * 卡片总高度与宽度的比例（height / width）
	 * 包含封面 + 卡片 footer，用于估算每行高度。
	 * 默认 1.6（封面约 1:1 + footer 约 60px）
	 */
	avgItemRatio?: number;
	/** 缓冲倍数（额外加载视口外的数据），默认 1.5 */
	bufferMultiplier?: number;
	/** 最小返回值，默认 10 */
	min?: number;
	/** 最大返回值，默认 100 */
	max?: number;
}

export const DEFAULT_CONFIG = {
	bufferMultiplier: 1.5,
	avgItemRatio: 1.6,
	min: 10,
	max: 100
};

/**
 * 估算首屏所需的数据条数
 *
 * 基于容器尺寸、列数和卡片比例进行粗略估算，
 * 用于在 FeedStore 发起首次请求前计算合适的 needNum，
 * 避免请求过少导致白屏、过多导致带宽浪费。
 *
 * 实际卡片高度将由 ResizeObserver 实测并修正，
 * 此函数仅负责"足够好"的初始估算。
 *
 * @param params - 估算参数
 * @returns 建议的请求数量
 */
export function estimateNeedNum(
	contentType: 'waterfall' | 'list',
	params: EstimateNeedNumParams
): number {
	const {
		containerWidth,
		containerHeight,
		minItemWidth,
		gap: gapInput,
		avgItemRatio,
		bufferMultiplier,
		min,
		max
	} = { ...DEFAULT_CONFIG, ...params };

	if (containerWidth <= 0 || containerHeight <= 0) return min;

	const gap = contentType === 'waterfall' ? gapInput : 0;
	const { columnCount, cardWidth: itemWidth } =
		contentType === 'waterfall'
			? calculateLayoutBase(containerWidth, minItemWidth, gap)
			: { columnCount: 1, cardWidth: containerWidth };
	// 单张卡片的平均总高度（含 gap）
	const avgItemHeight = itemWidth * avgItemRatio + gap;
	// 视口内可见行数
	const visibleRows = Math.ceil(containerHeight / avgItemHeight);
	// 含缓冲区的总估算量
	const raw = visibleRows * columnCount * bufferMultiplier;
	return Math.max(min, Math.min(max, Math.ceil(raw)));
}
