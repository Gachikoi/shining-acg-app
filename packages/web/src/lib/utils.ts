import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
	ref?: U | null;
};

/**
 * 将数字字符串按 PRD §3.3 规则格式化为易读形式
 *
 * | 数量级       | 格式              | 示例          |
 * |-------------|-------------------|---------------|
 * | < 10,000    | 原始数字           | 1, 199, 9999  |
 * | 万级         | x.x 万            | 1.1 万        |
 * | 亿级         | x.x 亿            | 1.1 亿        |
 *
 * @param numStr - 数字字符串，undefined / 空字符串时返回 '0'
 * @returns 格式化后的展示字符串
 */
export function formatStat(numStr: string | undefined): string {
	if (!numStr) return '0';
	const num = parseInt(numStr, 10);
	if (isNaN(num)) return '0';
	if (num >= 1_0000_0000) return (num / 1_0000_0000).toFixed(1) + ' 亿';
	if (num >= 1_0000) return (num / 1_0000).toFixed(1) + ' 万';
	return num.toString();
}

// safari 降级方案：使用 setTimeout 模拟 requestIdleCallback 的行为
export const scheduleIdleTask = (task: () => void | Promise<void>): number => {
	const globalWithIdleCallback = globalThis as typeof globalThis & {
		requestIdleCallback?: (callback: () => void) => number;
	};

	if (typeof globalWithIdleCallback.requestIdleCallback === 'function') {
		return globalWithIdleCallback.requestIdleCallback(task);
	}

	// Safari 不支持 requestIdleCallback，降级为 setTimeout 触发异步任务
	// Number() 将 Node 环境下 Timeout 对象显式转为 number，与浏览器 setTimeout 返回值类型对齐
	return Number(setTimeout(task, 1));
};

export function formatTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp * 1000;
	const hour = 60 * 60 * 1000;
	if (diff < hour) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
	if (diff < hour * 24) return `${Math.floor(diff / hour)} 小时前`;
	return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * 创建一个并发限制器
 * 用于控制异步任务的并发执行数量
 *
 * @param initialLimit - 初始最大并发数，默认为 10
 * @returns 包含 run 和 setLimit 方法的对象
 */
export function createConcurrencyLimiter(initialLimit = 10) {
	let limit = initialLimit;
	let running = 0;
	const queue: (() => Promise<unknown>)[] = [];

	/**
	 * 尝试执行下一个任务
	 * 递归调用以维持并发队列流转
	 */
	const next = () => {
		while (running < limit && queue.length > 0) {
			const task = queue.shift();
			if (task) {
				running++;
				// 使用 Promise.resolve 包装以处理同步错误和非 Promise 返回值
				Promise.resolve()
					.then(() => task())
					.catch((e) => console.warn('任务执行失败：', e))
					.finally(() => {
						running--;
						next();
					});
			}
		}
	};

	/**
	 * 提交一个异步任务
	 * @param task - 返回 Promise 的异步任务函数
	 */
	const run = async (task: () => Promise<unknown>) => {
		queue.push(task);
		next();
	};

	/**
	 * 动态调整最大并发数
	 * @param newLimit - 新的并发限制
	 */
	const setLimit = (newLimit: number) => {
		limit = newLimit;
		next();
	};

	return {
		run,
		setLimit
	};
}
