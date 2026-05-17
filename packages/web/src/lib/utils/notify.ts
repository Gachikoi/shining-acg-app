/**
 * 全局通知统一入口。
 *
 * 对 svelte-sonner 的 `toast` 做一层业务封装，收敛重复的错误处理模式：
 * - `operationError`：自动检测网络错误，统一提示「网络异常，请检查网络后重试」
 * - `uploadError`：自动提取上传错误的详细信息，支持 fallback 文案
 *
 * 新增通知时优先从本文件导入 `notify`，不再直接引入 `svelte-sonner`。
 * 其他模块（comment-section、post-detail、home 等）可参考 JSDoc 中的迁移建议逐步替换。
 */
import { toast, type ExternalToast } from 'svelte-sonner';
import { messageForOperationError } from './operation-error-message';
import { formatUploadError } from './format-upload-error';

type ToastOptions = ExternalToast;

export const notify = {
	success: (message: string, options?: ToastOptions) => toast.success(message, options),
	error: (message: string, options?: ToastOptions) => toast.error(message, options),
	info: (message: string, options?: ToastOptions) => toast.info(message, options),
	warning: (message: string, options?: ToastOptions) => toast.warning(message, options),

	/**
	 * 操作失败时的错误提示。自动检测网络错误并统一提示。
	 *
	 * @example
	 * // 建议迁移：comment-section、post-detail、edit-comment-popover、image-video-preview 中的
	 * // toast.error(messageForOperationError(err, 'xxx失败，请重试'))
	 * // 可替换为 notify.operationError(err, 'xxx失败，请重试')
	 */
	operationError: (err: unknown, defaultMessage: string, options?: ToastOptions) => {
		toast.error(messageForOperationError(err, defaultMessage), options);
	},

	/**
	 * 上传错误提示。自动提取错误详情，支持 fallback 文案。
	 *
	 * @example
	 * // 建议迁移：release-upload、release-editor-core、release/+page 中的
	 * // toast.error(formatUploadError(err) || TOAST_MESSAGES.UPLOAD_ERROR_RETRY)
	 * // 可替换为 notify.uploadError(err, TOAST_MESSAGES.UPLOAD_ERROR_RETRY)
	 */
	uploadError: (err: unknown, fallbackMessage: string, options?: ToastOptions) => {
		toast.error(formatUploadError(err) || fallbackMessage, options);
	},

	promise: toast.promise,
	dismiss: toast.dismiss
};
