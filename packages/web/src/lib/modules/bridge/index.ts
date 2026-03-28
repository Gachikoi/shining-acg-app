// 自定义 JSBridge 实现
import type { Bridge, VibrationOptions } from './types';

const postToNative = <T extends object>(action: string, payload?: T) => {
	const message = { action, ...payload };

	// Android Bridge
	if (typeof window !== 'undefined' && window?.AndroidBridge?.postMessage) {
		window.AndroidBridge.postMessage(JSON.stringify(message));
		return true;
	}

	// iOS WKWebView Bridge
	if (
		typeof window !== 'undefined' &&
		window?.webkit?.messageHandlers?.ShiningBridge?.postMessage
	) {
		window.webkit.messageHandlers.ShiningBridge.postMessage(message);
		return true;
	}

	// 3. Dev/Web Fallback
	return false;
};

/**
 * Feature: Vibrate
 * 完美支持 iOS 各类震动返回，支持 Android、Web 基础震动功能
 */
const vibrate = (input?: VibrationOptions) => {
	const payload = input || { type: 'impact', style: 'medium' };

	const isNativeHandled = postToNative('vibrate', payload);

	// Web Fallback
	if (!isNativeHandled && typeof navigator !== 'undefined' && navigator?.vibrate) {
		navigator.vibrate(200); // 默认 200 ms
	}
};

/**
 * Feature: Prepare for Vibrate
 * 提升 iOS 震动响应速度-仅对 iOS 有效
 */
const prepareForVibrate = (input?: VibrationOptions) => {
	const payload = input || { type: 'impact', style: 'medium' };
	postToNative('prepareForVibrate', payload);
};

export const shiningBridge: Bridge = {
	vibrate,
	prepareForVibrate
};

if (typeof window !== 'undefined') {
	window.ShiningBridge = shiningBridge;
	console.log('window.ShiningBridge 已挂载');
}
