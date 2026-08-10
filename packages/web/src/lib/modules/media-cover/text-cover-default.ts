import type { CoverRatio } from '$lib/stores/release';
import {
	DEFAULT_TEXT_BG,
	DEFAULT_TEXT_FG,
	DEFAULT_TEXT_SUB,
	type RenderTextCoverOptions
} from './types';
import { canvasToBlob, cleanText } from './utils';

export async function renderDefaultTextCover(options: RenderTextCoverOptions): Promise<Blob> {
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
		cursorY += Math.round(height * 0.055);
	}

	return canvasToBlob(canvas, 'image/jpeg', 0.9);
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
		lines[maxLines - 1] = `${lines[maxLines - 1].slice(
			0,
			Math.max(0, lines[maxLines - 1].length - 1)
		)}…`;
	}
	return lines;
}
