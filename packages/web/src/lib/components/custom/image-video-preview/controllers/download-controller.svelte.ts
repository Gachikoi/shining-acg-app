/**
 * @module download-controller
 *
 * **职责**：统一管理预览器的下载菜单（长按/右键）与下载行为。
 * - 只维护下载相关 state（菜单开关/位置/关闭时间戳）
 * - 下载实现包含 fetch + `<a>` fallback（用于跨域/鉴权/CORS 场景降级）
 *
 * **说明**：不直接依赖 toast，由调用方决定如何提示错误。
 */
import type { V1MediaAsset as Media } from '$lib/api';
import { getMediaDisplayUrl } from '$lib/utils/media-url';

export type DownloadMenuPosition = { x: number; y: number } | null;

export type DownloadController = ReturnType<typeof createDownloadController>;

function messageForDownloadError(err: unknown, fallback: string): string {
	if (err instanceof Error && err.message) return err.message;
	return fallback;
}

export function createDownloadController() {
	let isOpen = $state(false);
	let position = $state<DownloadMenuPosition>(null);
	let lastClosedAt = $state(0);

	function openAtPoint(x: number, y: number) {
		const menuWidth = 192; // w-48 = 12rem = 192px
		const menuHeight = 100; // 估算菜单高度
		const padding = 8;

		let adjustedX = x;
		let adjustedY = y;
		if (adjustedX + menuWidth + padding > window.innerWidth) {
			adjustedX = window.innerWidth - menuWidth - padding;
		}
		if (adjustedY + menuHeight + padding > window.innerHeight) {
			adjustedY = window.innerHeight - menuHeight - padding;
		}

		position = { x: adjustedX, y: adjustedY };
		isOpen = true;
	}

	function close() {
		if (!isOpen) return;
		isOpen = false;
		position = null;
		lastClosedAt = Date.now();
	}

	async function downloadMedia(media: Media): Promise<{ ok: boolean; errorMessage?: string }> {
		const mediaUrl = getMediaDisplayUrl(media);
		if (!mediaUrl) return { ok: false, errorMessage: '下载失败：媒体文件不存在' };

		const isCrossOrigin = (() => {
			try {
				if (typeof window === 'undefined') return true;
				return new URL(mediaUrl, window.location.href).origin !== window.location.origin;
			} catch {
				return true;
			}
		})();

		const isMediaImage = media.type === 'MEDIA_TYPE_IMAGE';
		const extension = isMediaImage ? 'jpg' : 'mp4';
		const fileId =
			media.single?.fileId ??
			media.livePhoto?.image?.fileId ??
			media.livePhoto?.video?.fileId ??
			Date.now().toString();
		const filename = `media_${fileId}.${extension}`;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 30000);
		try {
			const headers = new Headers();
			if (typeof window !== 'undefined') {
				const token = localStorage.getItem('token');
				if (token) headers.set('Authorization', `Bearer ${token}`);
			}

			const response = await fetch(mediaUrl, {
				mode: 'cors',
				credentials: 'omit',
				headers,
				signal: controller.signal
			});
			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
			return { ok: true };
		} catch {
			clearTimeout(timeoutId);
			try {
				const a = document.createElement('a');
				a.href = mediaUrl;
				if (!isCrossOrigin) a.download = filename;
				a.target = '_blank';
				a.rel = 'noopener';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				if (isCrossOrigin) {
					return {
						ok: false,
						errorMessage: '由于跨域/鉴权限制，浏览器无法直接下载该视频。已尝试在新页面打开。'
					};
				}
				return { ok: true };
			} catch (linkError) {
				return {
					ok: false,
					errorMessage: messageForDownloadError(
						linkError,
						'下载失败：可能是跨域(CORS)/鉴权/网络限制导致。'
					)
				};
			}
		}
	}

	return {
		state: {
			get isOpen() {
				return isOpen;
			},
			get position() {
				return position;
			},
			get lastClosedAt() {
				return lastClosedAt;
			}
		},
		actions: { openAtPoint, close, downloadMedia }
	};
}
