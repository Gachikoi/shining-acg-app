import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import type { ApiResponse, ApiError, RequestConfig } from './types';

/**
 * 获取认证 token
 */
function getAuthToken(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('token') || sessionStorage.getItem('token');
}

/**
 * 清除认证信息
 */
function clearAuth(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem('token');
	sessionStorage.removeItem('token');
}

/**
 * 跳转到登录页
 */
function redirectToLogin(): void {
	if (typeof window === 'undefined') return;
	// TODO: 根据实际路由配置修改登录页路径
	window.location.href = '/login';
}

/**
 * 请求拦截器
 */
function setupRequestInterceptor(instance: AxiosInstance): void {
	instance.interceptors.request.use(
		(config: InternalAxiosRequestConfig) => {
			// 获取请求配置中的自定义选项
			const customConfig = config as InternalAxiosRequestConfig & RequestConfig;

			// 添加认证 token（除非配置了 skipAuth）
			if (!customConfig.skipAuth) {
				const token = getAuthToken();
				if (token) {
					config.headers.Authorization = `Bearer ${token}`;
				}
			}

			// 开发环境：打印请求信息
			if (import.meta.env.DEV) {
				console.log('[API Request]', {
					method: config.method?.toUpperCase(),
					url: config.url,
					baseURL: config.baseURL,
					data: config.data
				});
			}

			return config;
		},
		(error: AxiosError) => {
			// 请求错误处理
			if (import.meta.env.DEV) {
				console.error('[API Request Error]', error);
			}
			return Promise.reject(error);
		}
	);
}

/**
 * 响应拦截器
 */
function setupResponseInterceptor(instance: AxiosInstance): void {
	instance.interceptors.response.use(
		(response: AxiosResponse<ApiResponse>) => {
			const config = response.config as InternalAxiosRequestConfig & RequestConfig;

			// 开发环境：打印响应信息
			if (import.meta.env.DEV) {
				console.log('[API Response]', {
					url: response.config.url,
					status: response.status,
					data: response.data
				});
			}

			// 如果配置了跳过统一错误处理，直接返回
			if (config.skipErrorHandler) {
				return response;
			}

			// 检查业务状态码
			const { code, data, message } = response.data;

			// 如果后端返回的业务状态码不是成功（假设 0 或 200 表示成功）
			if (code !== 0 && code !== 200) {
				const error: ApiError = {
					code,
					message: message || '请求失败'
				};

				// 开发环境：打印业务错误
				if (import.meta.env.DEV) {
					console.error('[API Business Error]', error);
				}

				return Promise.reject(error);
			}

			// 返回数据部分
			return {
				...response,
				data: data
			} as AxiosResponse;
		},
		(error: AxiosError<ApiError>) => {
			const config = error.config as InternalAxiosRequestConfig & RequestConfig;

			// 开发环境：打印错误信息
			if (import.meta.env.DEV) {
				console.error('[API Response Error]', {
					url: error.config?.url,
					status: error.response?.status,
					message: error.message,
					data: error.response?.data
				});
			}

			// 如果配置了跳过统一错误处理，直接返回
			if (config?.skipErrorHandler) {
				return Promise.reject(error);
			}

			// 处理 HTTP 错误状态码
			if (error.response) {
				const { status, data } = error.response;

				switch (status) {
					case 401:
						// 未授权：清除 token 并跳转登录
						clearAuth();
						redirectToLogin();
						return Promise.reject({
							code: 401,
							message: '未授权，请重新登录'
						} as ApiError);

					case 403:
						// 禁止访问
						return Promise.reject({
							code: 403,
							message: data?.message || '没有权限访问该资源'
						} as ApiError);

					case 404:
						// 资源不存在
						return Promise.reject({
							code: 404,
							message: data?.message || '请求的资源不存在'
						} as ApiError);

					case 422:
						// 参数验证错误
						return Promise.reject({
							code: 422,
							message: data?.message || '请求参数错误',
							errors: data?.errors
						} as ApiError);

					case 500:
					case 502:
					case 503:
						// 服务器错误
						return Promise.reject({
							code: status,
							message: data?.message || '服务器错误，请稍后重试'
						} as ApiError);

					default:
						// 其他错误
						return Promise.reject({
							code: status,
							message: data?.message || error.message || '请求失败'
						} as ApiError);
				}
			}

			// 网络错误或其他错误
			if (error.request) {
				return Promise.reject({
					code: 0,
					message: '网络连接失败，请检查网络设置'
				} as ApiError);
			}

			// 请求配置错误
			return Promise.reject({
				code: 0,
				message: error.message || '请求配置错误'
			} as ApiError);
		}
	);
}

/**
 * 设置所有拦截器
 */
export function setupInterceptors(instance: AxiosInstance): void {
	setupRequestInterceptor(instance);
	setupResponseInterceptor(instance);
}
