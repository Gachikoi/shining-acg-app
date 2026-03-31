import axios from 'axios';

/**
 * 判断是否为网络不可用、超时等（非业务 HTTP 错误体）。
 */
export function isLikelyNetworkError(err: unknown): boolean {
	if (axios.isAxiosError(err)) {
		if (err.code === 'ECONNABORTED') return true;
		if (err.code === 'ERR_NETWORK') return true;
		if (err.message === 'Network Error') return true;
		if (!err.response) return true;
		return false;
	}
	if (err instanceof TypeError) {
		const m = err.message ?? '';
		if (m.includes('Failed to fetch') || m.includes('Load failed')) return true;
	}
	return false;
}

/**
 * 操作失败时的用户可见文案：网络问题统一提示，否则使用默认说明。
 */
export function messageForOperationError(err: unknown, defaultMessage: string): string {
	return isLikelyNetworkError(err) ? '网络异常，请检查网络后重试' : defaultMessage;
}
