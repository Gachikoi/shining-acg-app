/**
 * 官网编辑相关 API 接口
 */
import apiClient from './client';
import type { WebsiteContent } from '$lib/types/website';

/**
 * 文件上传响应
 */
export interface UploadResponse {
	url: string; // 上传后的文件URL
}

/**
 * 上传图片
 * @param file 图片文件
 * @param type 图片类型：'logo' | 'promotional' | 'history'
 * @returns 上传后的URL
 */
export async function uploadImage(
	file: File,
	type: 'logo' | 'promotional' | 'history' = 'promotional'
): Promise<string> {
	const formData = new FormData();
	formData.append('file', file);
	formData.append('type', type);

	const response = await apiClient.post<UploadResponse>('/api/website/upload/image', formData, {
		headers: {
			'Content-Type': 'multipart/form-data'
		}
	});

	return response.data.url;
}

/**
 * 上传视频
 * @param file 视频文件
 * @param type 视频类型：'homepage' | 'promotional'
 * @returns 上传后的URL
 */
export async function uploadVideo(
	file: File,
	type: 'homepage' | 'promotional' = 'promotional'
): Promise<string> {
	const formData = new FormData();
	formData.append('file', file);
	formData.append('type', type);

	const response = await apiClient.post<UploadResponse>('/api/website/upload/video', formData, {
		headers: {
			'Content-Type': 'multipart/form-data'
		}
	});

	return response.data.url;
}

/**
 * 获取官网内容
 * @returns 官网内容数据
 */
export async function getWebsiteContent(): Promise<WebsiteContent> {
	const response = await apiClient.get<WebsiteContent>('/api/website/content');
	return response.data;
}

/**
 * 保存官网内容（草稿）
 * @param content 官网内容数据
 * @returns 保存结果
 */
export async function saveWebsiteContent(content: WebsiteContent): Promise<void> {
	await apiClient.post<void>('/api/website/content/save', content);
}

/**
 * 发布官网内容
 * @param content 官网内容数据
 * @returns 发布结果
 */
export async function publishWebsiteContent(content: WebsiteContent): Promise<void> {
	await apiClient.post<void>('/api/website/content/publish', content);
}
