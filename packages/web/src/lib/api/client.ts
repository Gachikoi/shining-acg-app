import axios, { type AxiosInstance } from 'axios';
import { env } from '$env/dynamic/public';
import { setupInterceptors } from './interceptors';

/**
 * 获取 API 基础 URL
 */
function getApiBaseUrl(): string {
	const isTest = env.PUBLIC_IS_TEST === 'true';
	return isTest ? 'https://test.api.shiningacg.club' : 'https://api.shiningacg.club';
}

/**
 * 创建 Axios 实例
 */
const apiClient: AxiosInstance = axios.create({
	baseURL: getApiBaseUrl(),
	timeout: 10000, // 10 秒超时
	headers: {
		'Content-Type': 'application/json'
	}
});

// 设置拦截器
setupInterceptors(apiClient);

export default apiClient;

import axios, { type AxiosInstance } from 'axios';
import { env } from '$env/dynamic/public';
import { setupInterceptors } from './interceptors';

/**
 * 获取 API 基础 URL
 */
function getApiBaseUrl(): string {
	const isTest = env.PUBLIC_IS_TEST === 'true';
	return isTest ? 'https://test.api.shiningacg.club' : 'https://api.shiningacg.club';
}

/**
 * 创建 Axios 实例
 */
const apiClient: AxiosInstance = axios.create({
	baseURL: getApiBaseUrl(),
	timeout: 10000, // 10 秒超时
	headers: {
		'Content-Type': 'application/json'
	}
});

// 设置拦截器
setupInterceptors(apiClient);

export default apiClient;
