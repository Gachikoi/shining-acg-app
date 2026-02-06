/**
 * API 响应包装类型
 */
export interface ApiResponse<T = unknown> {
	code: number;
	data: T;
	message: string;
}

/**
 * API 错误响应类型
 */
export interface ApiError {
	code: number;
	message: string;
	errors?: Record<string, string[]>;
}

/**
 * 请求配置扩展
 */
export interface RequestConfig {
	skipAuth?: boolean; // 是否跳过认证
	skipErrorHandler?: boolean; // 是否跳过统一错误处理
}
