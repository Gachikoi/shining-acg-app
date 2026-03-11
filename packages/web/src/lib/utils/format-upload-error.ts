/**
 * 将上传相关错误格式化为可读字符串，用于 toast 或日志。
 * 提取 Error.message、code、source.status、response.data 等字段。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function shortText(value: unknown, max = 180): string {
	const text = String(value ?? '').trim();
	if (!text) {
		return '';
	}
	return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * 格式化上传错误为可读字符串。
 *
 * @param error - 捕获的未知错误
 * @returns 格式化后的字符串，包含 message、code、source、response 等可用信息
 */
export function formatUploadError(error: unknown): string {
	const parts: string[] = [];
	if (error instanceof Error) {
		parts.push(`message=${error.message}`);
		if (error.name) {
			parts.push(`name=${error.name}`);
		}
	} else {
		parts.push(`raw=${shortText(error)}`);
	}

	if (!isRecord(error)) {
		return parts.join(' | ');
	}

	const code = error.code;
	if (typeof code === 'string' || typeof code === 'number') {
		parts.push(`code=${String(code)}`);
	}

	if (isRecord(error.source)) {
		const source = error.source;
		const status = source.status;
		if (typeof status === 'number') {
			parts.push(`source.status=${status}`);
		}
		const readyState = source.readyState;
		if (typeof readyState === 'number') {
			parts.push(`source.readyState=${readyState}`);
		}
		if (typeof source.responseURL === 'string' && source.responseURL) {
			parts.push(`source.url=${source.responseURL}`);
		}
		if (typeof source.responseText === 'string' && source.responseText) {
			parts.push(`source.body=${shortText(source.responseText)}`);
		}
	}

	if (isRecord(error.response)) {
		const response = error.response;
		const status = response.status;
		if (typeof status === 'number') {
			parts.push(`response.status=${status}`);
		}
		if (response.data !== undefined) {
			parts.push(`response.data=${shortText(response.data)}`);
		}
	}

	return parts.join(' | ');
}
