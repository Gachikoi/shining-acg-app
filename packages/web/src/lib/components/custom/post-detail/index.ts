/** 帖子详情弹层、真实/Mock API 工厂，供页面与调试路由引用。 */
export { default as PostDetail } from './post-detail.svelte';
export {
	type PostDetailApi,
	type PostDetailMe,
	type UserFollowStatus,
	createRealPostDetailApi
} from './api';
export { createMockPostDetailApi } from './api-mock';
