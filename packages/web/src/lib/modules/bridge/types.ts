// Unified Options Type
export type VibrationOptions = ImpactOptions | NotificationOptions | SelectionOptions;

// Define the shape of the bridge object
export interface Bridge {
	vibrate: (options?: VibrationOptions) => void;
	prepareForVibrate: (options?: VibrationOptions) => void;
}

// Base options available to all vibration types
interface BaseVibrationOptions {
	x?: number; // 震动触发位置 X (iOS 17.5+)
	y?: number; // 震动触发位置 Y (iOS 17.5+)
}

// 1. Impact Feedback
interface ImpactOptions extends BaseVibrationOptions {
	type: 'impact';
	style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
}

// 2. Notification Feedback
interface NotificationOptions extends BaseVibrationOptions {
	type: 'notification';
	style: 'success' | 'warning' | 'error';
}

// 3. Selection Feedback
interface SelectionOptions extends BaseVibrationOptions {
	type: 'selection';
}

// Define the native interface shapes for type safety inside this module
interface NativeAndroidBridge {
	postMessage: (message: string) => void;
}

interface NativeIosBridgeHandler {
	postMessage: (message: unknown) => void;
}

// Extend the global window object locally to avoid TS errors in this file
declare global {
	interface Window {
		ShiningBridge: Bridge;
		AndroidBridge?: NativeAndroidBridge;
		webkit?: {
			messageHandlers?: {
				ShiningBridge?: NativeIosBridgeHandler;
			};
		};
	}
}
