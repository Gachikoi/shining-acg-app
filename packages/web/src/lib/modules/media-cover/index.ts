import type { V1PostContentUnit } from '$lib/api/types.gen';
import { getPreviewBlob } from '$lib/modules/release-media';
import type { CoverRatio, DraftMediaItem } from '$lib/stores/release';

export type CoverSource = 'selected-image' | 'video-first-frame' | 'text-generated';

export interface ExtractVideoFrameOptions {
	timeSec?: number;
	fallbackTimeSec?: number;
	maxLongEdge?: number;
	/** 输出格式。quality 仅在 image/jpeg 或 image/webp 时生效，PNG 为无损格式会忽略 quality。 */
	mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
	/** 压缩质量 0–1，仅对 image/jpeg 和 image/webp 有效。 */
	quality?: number;
}

export interface RenderTextCoverOptions {
	title?: string;
	bodyText?: string;
	ratio: CoverRatio;
}

export interface ResolveCoverBlobOptions {
	mediaItems: DraftMediaItem[];
	selectedCoverIndex: number;
	ratio: CoverRatio;
	title?: string;
	content?: V1PostContentUnit[];
}

const DEFAULT_LONG_EDGE = 1280;
const DEFAULT_VIDEO_TIME_SEC = 0.1;
const DEFAULT_VIDEO_FALLBACK_TIME_SEC = 0;
const DEFAULT_TEXT_BG = '#0f172a';
const DEFAULT_TEXT_FG = '#f8fafc';
const DEFAULT_TEXT_SUB = '#cbd5e1';

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

export async function renderTextCoverBlob(options: RenderTextCoverOptions): Promise<Blob> {
	const { width, height } = getCanvasSizeByRatio(options.ratio);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Failed to get canvas context');
	}

	const gradient = ctx.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, '#1e293b');
	gradient.addColorStop(0.55, DEFAULT_TEXT_BG);
	gradient.addColorStop(1, '#111827');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);

	const title = cleanText(options.title ?? '');
	const body = cleanText(options.bodyText ?? '');
	const safeTitle = title || '无标题';
	const summary = body || '添加图片、视频或正文内容后，系统会自动生成封面。';

	const horizontalPadding = Math.round(width * 0.08);
	const topPadding = Math.round(height * 0.12);
	const maxTextWidth = width - horizontalPadding * 2;

	ctx.fillStyle = DEFAULT_TEXT_FG;
	ctx.font = `${Math.round(width * 0.075)}px sans-serif`;
	ctx.textBaseline = 'top';
	const titleLines = splitLines(ctx, safeTitle, maxTextWidth, 2);
	let cursorY = topPadding;
	for (const line of titleLines) {
		ctx.fillText(line, horizontalPadding, cursorY);
		cursorY += Math.round(width * 0.09);
	}

	cursorY += Math.round(height * 0.04);
	ctx.fillStyle = DEFAULT_TEXT_SUB;
	ctx.font = `${Math.max(24, Math.round(width * 0.04))}px sans-serif`;
	const bodyLines = splitLines(ctx, summary, maxTextWidth, 6);
	for (const line of bodyLines) {
		ctx.fillText(line, horizontalPadding, cursorY);
		cursorY += Math.round(width * 0.055);
	}

	return canvasToBlob(canvas, 'image/jpeg', 0.9);
}

export async function resolveCoverBlob(options: ResolveCoverBlobOptions): Promise<{
	blob: Blob;
	source: CoverSource;
}> {
	const items = options.mediaItems ?? [];
	if (items.length > 0) {
		// 策略优先级：用户当前选中项 > 同列表其他可用项 > 文本封面。
		const preferredIndex = clamp(options.selectedCoverIndex, 0, items.length - 1);
		const preferredItem = items[preferredIndex];
		if (isImageItem(preferredItem)) {
			return {
				blob: getPreviewBlob(preferredItem),
				source: 'selected-image'
			};
		}
		if (isVideoItem(preferredItem)) {
			const frameBlob = await extractVideoFrameBlob(getVideoBlob(preferredItem));
			return { blob: frameBlob, source: 'video-first-frame' };
		}

		const fallbackImage = items.find(isImageItem);
		if (fallbackImage) {
			return { blob: getPreviewBlob(fallbackImage), source: 'selected-image' };
		}
		const fallbackVideo = items.find(isVideoItem);
		if (fallbackVideo) {
			const frameBlob = await extractVideoFrameBlob(getVideoBlob(fallbackVideo));
			return { blob: frameBlob, source: 'video-first-frame' };
		}
	}

	const textBlob = await renderTextCoverBlob({
		title: options.title,
		bodyText: contentUnitsToPlainText(options.content ?? []),
		ratio: options.ratio
	});
	return { blob: textBlob, source: 'text-generated' };
}

function getCanvasSizeByRatio(ratio: CoverRatio): { width: number; height: number } {
	switch (ratio) {
		case '1:1':
			return { width: 1080, height: 1080 };
		case '4:3':
			return { width: 1200, height: 900 };
		case '3:4':
		default:
			return { width: 900, height: 1200 };
	}
}

function isImageItem(item: DraftMediaItem): boolean {
	if (item.kind === 'live_photo') return true;
	return isImageMime(item.blob.type) || isImageFileName(item.name);
}

function isVideoItem(item: DraftMediaItem): boolean {
	if (item.kind === 'live_photo') return false;
	return isVideoMime(item.blob.type) || isVideoFileName(item.name);
}

function getVideoBlob(item: DraftMediaItem): Blob {
	if (item.kind === 'live_photo') {
		return item.videoBlob;
	}
	return item.blob;
}

function isImageMime(type: string): boolean {
	return type.startsWith('image/');
}

function isVideoMime(type: string): boolean {
	return type.startsWith('video/');
}

function isImageFileName(name: string): boolean {
	return /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
}

function isVideoFileName(name: string): boolean {
	return /\.(mp4|mov|m4v|webm)$/i.test(name);
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

/**
 * 将 canvas 导出为 Blob。
 * quality 仅对 image/jpeg 和 image/webp 生效，PNG 为无损格式会忽略 quality。
 */
function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
	quality: number
): Promise<Blob> {
	return new Promise<Blob>((resolve, reject) => {
		const onBlob = (blob: Blob | null) => {
			if (!blob) {
				reject(new Error('Failed to export canvas blob'));
				return;
			}
			resolve(blob);
		};
		if (mimeType === 'image/png') {
			canvas.toBlob(onBlob, mimeType);
		} else {
			canvas.toBlob(onBlob, mimeType, quality);
		}
	});
}

function cleanText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function splitLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	maxLines: number
): string[] {
	if (!text) return [];
	const chars = [...text];
	const lines: string[] = [];
	let current = '';
	for (const ch of chars) {
		const candidate = current + ch;
		if (ctx.measureText(candidate).width <= maxWidth) {
			current = candidate;
			continue;
		}
		if (current) lines.push(current);
		current = ch;
		if (lines.length >= maxLines) break;
	}
	if (current && lines.length < maxLines) {
		lines.push(current);
	}
	if (lines.length === maxLines && chars.join('').length > lines.join('').length) {
		lines[maxLines - 1] =
			`${lines[maxLines - 1].slice(0, Math.max(0, lines[maxLines - 1].length - 1))}…`;
	}
	return lines;
}

function contentUnitsToPlainText(content: V1PostContentUnit[]): string {
	return cleanText(
		content
			.map((unit) => {
				if (unit.type === 'text') {
					return unit.content;
				}
				return `@${unit.name}`;
			})
			.join(' ')
	);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
