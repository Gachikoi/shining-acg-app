import {
	DEFAULT_LONG_EDGE,
	DEFAULT_VIDEO_FALLBACK_TIME_SEC,
	DEFAULT_VIDEO_TIME_SEC,
	type ExtractVideoFrameOptions
} from './types';
import { canvasToBlob, clamp } from './utils';

export async function extractVideoFrameBlob(
	videoBlob: Blob,
	options: ExtractVideoFrameOptions = {}
): Promise<Blob> {
	const {
		timeSec = DEFAULT_VIDEO_TIME_SEC,
		fallbackTimeSec = DEFAULT_VIDEO_FALLBACK_TIME_SEC,
		maxLongEdge = DEFAULT_LONG_EDGE,
		mimeType = 'image/jpeg',
		quality = 0.86
	} = options;
	const objectUrl = URL.createObjectURL(videoBlob);
	const video = document.createElement('video');
	video.preload = 'metadata';
	video.muted = true;
	video.playsInline = true;
	video.src = objectUrl;

	try {
		// 先等元信息，拿到 duration / videoWidth / videoHeight 后再 seek 更稳定。
		await waitForEvent(video, 'loadedmetadata');
		try {
			return await drawFrame(video, timeSec, maxLongEdge, mimeType, quality);
		} catch {
			// 某些视频在开头首帧不可解码，回退到 0s 再尝试一次。
			return await drawFrame(video, fallbackTimeSec, maxLongEdge, mimeType, quality);
		}
	} finally {
		video.removeAttribute('src');
		video.load();
		URL.revokeObjectURL(objectUrl);
	}
}

async function drawFrame(
	video: HTMLVideoElement,
	timeSec: number,
	maxLongEdge: number,
	mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
	quality: number
): Promise<Blob> {
	if (video.readyState < 2) {
		// iOS/低端设备上仅有 metadata 还不够，等待首帧数据可避免 drawImage 空帧。
		await waitForEvent(video, 'loadeddata');
	}
	const targetTime = getSafeTargetTime(video.duration, timeSec);
	await seekVideo(video, targetTime);

	const sourceWidth = video.videoWidth;
	const sourceHeight = video.videoHeight;
	if (!sourceWidth || !sourceHeight) {
		throw new Error('Invalid video frame dimensions');
	}

	const [canvasWidth, canvasHeight] = fitLongEdge(sourceWidth, sourceHeight, maxLongEdge);
	const canvas = document.createElement('canvas');
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Failed to get canvas context');
	}

	ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
	return canvasToBlob(canvas, mimeType, quality);
}

function fitLongEdge(width: number, height: number, maxLongEdge: number): [number, number] {
	const longEdge = Math.max(width, height);
	if (longEdge <= maxLongEdge) {
		return [width, height];
	}
	// 限制长边可控制内存峰值，避免高分辨率视频抽帧导致页面卡顿。
	const scale = maxLongEdge / longEdge;
	return [Math.round(width * scale), Math.round(height * scale)];
}

function getSafeTargetTime(duration: number, target: number): number {
	if (!Number.isFinite(duration) || duration <= 0) {
		return Math.max(0, target);
	}
	const maxSeek = Math.max(0, duration - 0.05);
	return clamp(target, 0, maxSeek);
}

function seekVideo(video: HTMLVideoElement, targetTime: number): Promise<void> {
	if (Math.abs(video.currentTime - targetTime) < 0.02 && video.readyState >= 2) {
		return Promise.resolve();
	}
	return new Promise<void>((resolve, reject) => {
		const cleanup = () => {
			video.removeEventListener('seeked', onSeeked);
			video.removeEventListener('error', onError);
		};
		const onSeeked = () => {
			cleanup();
			resolve();
		};
		const onError = () => {
			cleanup();
			reject(new Error('Failed to seek video'));
		};
		video.addEventListener('seeked', onSeeked, { once: true });
		video.addEventListener('error', onError, { once: true });
		try {
			video.currentTime = targetTime;
		} catch (error) {
			cleanup();
			reject(error instanceof Error ? error : new Error('Failed to set currentTime'));
		}
	});
}

function waitForEvent(target: EventTarget, eventName: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const onDone = () => {
			cleanup();
			resolve();
		};
		const onError = () => {
			cleanup();
			reject(new Error(`Failed while waiting event: ${eventName}`));
		};
		const cleanup = () => {
			target.removeEventListener(eventName, onDone);
			target.removeEventListener('error', onError);
		};
		target.addEventListener(eventName, onDone, { once: true });
		target.addEventListener('error', onError, { once: true });
	});
}
