import { DOMAIN_CONFIG } from '$lib/constants';
import axios from 'axios';
import type { CreateClientConfig } from './lib/api/client';

// 1. 创建自定义 Axios 实例
const axiosInstance = axios.create();

// 2. 配置拦截器 (Request Interceptor)
axiosInstance.interceptors.request.use(
	(config) => {
		// 例如：自动添加 Token
		const token = localStorage.getItem('token');
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// 2. 配置拦截器 (Response Interceptor)
axiosInstance.interceptors.response.use(
	(response) => {
		return response;
	},
	(error) => {
		// 例如：统一处理 401 未登录
		if (error.response?.status === 401) {
			// 跳转登录页或刷新 Token
		}
		return Promise.reject(error);
	}
);

export const createClientConfig: CreateClientConfig = (config) => ({
	...config,
	// 3. 将自定义实例传入配置
	axios: axiosInstance,
	baseURL: `https://${DOMAIN_CONFIG.api}`,
	throwOnError: true
});
