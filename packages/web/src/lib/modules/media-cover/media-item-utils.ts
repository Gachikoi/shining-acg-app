import type { DraftMediaItem } from '$lib/stores/release';

export function isImageItem(item: DraftMediaItem): boolean {
	if (item.kind === 'live_photo') return true;
	return isImageMime(item.blob.type) || isImageFileName(item.name);
}

export function isVideoItem(item: DraftMediaItem): boolean {
	if (item.kind === 'live_photo') return false;
	return isVideoMime(item.blob.type) || isVideoFileName(item.name);
}

export function getVideoBlob(item: DraftMediaItem): Blob {
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
