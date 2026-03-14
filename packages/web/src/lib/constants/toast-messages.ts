export const TOAST_MESSAGES = {
	NO_CHANGES_TO_SAVE: '没有需要保存的变更',
	PLEASE_SELECT_PARTITION: '请选择分区',
	POST_PUBLISHED_SUCCESS: '帖子发布成功',
	UPLOAD_ERROR_RETRY: '帖子上传过程中发生错误，请重试',
	UPLOAD_CANCELLED: '已取消上传',
	CONTENT_REQUIRED: '至少需要填写标题、正文、或添加图片/视频',
	VIDEO_THUMBNAIL_FAILED: '部分视频缩略图生成失败',
	UPLOAD_PARTIAL_FAILED: '部分文件上传失败，可重试或删除失败项后继续发布',
	REMOVE_FAILED_CONFIRM: '确定要删除失败的文件并继续发布吗？将仅使用已成功上传的文件。'
} as const;

export type ToastMessageKey = keyof typeof TOAST_MESSAGES;
