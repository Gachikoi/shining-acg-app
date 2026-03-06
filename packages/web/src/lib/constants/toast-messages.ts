export const TOAST_MESSAGES = {
	NO_CHANGES_TO_SAVE: '没有需要保存的变更',
	PLEASE_SELECT_PARTITION: '请选择分区',
	POST_PUBLISHED_SUCCESS: '帖子发布成功',
	UPLOAD_ERROR_RETRY: '帖子上传过程中发生错误，请重试',
	UPLOAD_CANCELLED: '已取消上传',
	CONTENT_REQUIRED: '至少需要填写标题、正文、或添加图片/视频'
} as const;

export type ToastMessageKey = keyof typeof TOAST_MESSAGES;
