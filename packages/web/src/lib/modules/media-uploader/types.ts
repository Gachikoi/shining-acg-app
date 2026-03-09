import type { AwsS3MultipartOptions } from '@uppy/aws-s3';
import type { UploadResult, Uppy, UppyFile } from '@uppy/core';
import type { V1MediaAsset, V1MediaScene, V1UploadAsset } from '../../api';
import type { RealtimeBatchProgress } from '../realtime/core';

export interface UploadFileInput {
	file: File;
	fileHash?: string;
}

/**
 * PrepareUploadParamAsset 表示一个业务媒体数组元素。
 * cropCover 是元素级属性（裁剪比例由展示需求决定，与文件本身无关），
 * 仅 MEDIA_SCENE_POST_COVER 场景下有效，其余场景忽略。
 * Live Photo 同样支持 cropCover，裁剪逻辑作用于其图片轨。
 */
export type PrepareUploadParamAsset =
	| {
			kind: 'single';
			scene: V1MediaScene;
			single: UploadFileInput;
			/** 帖子封面是否裁剪为 3:4，仅 POST_COVER 场景有效 */
			cropCover?: boolean;
	  }
	| {
			kind: 'live_photo';
			scene: V1MediaScene;
			livePhoto: {
				image: UploadFileInput;
				video: UploadFileInput;
			};
			/** 帖子封面是否裁剪为 3:4，仅 POST_COVER 场景有效，裁剪作用于图片轨 */
			cropCover?: boolean;
	  };

export type PrepareUploadParams = PrepareUploadParamAsset[];

export interface PrepareUploadSelection {
	scene: V1MediaScene;
	files: FileList | File[];
	fileHashByName?: Record<string, string>;
	/** 帖子封面是否裁剪为 3:4，仅 POST_COVER 场景有效 */
	cropCover?: boolean;
}

export type UploadBody = Record<string, never>;
export type UploadFile = UppyFile<MediaUploadMeta, UploadBody>;

export type FlatUploadFile = {
	localFileId: string;
	file: File;
	scene: V1MediaScene;
	role: 'single' | 'live_photo_image' | 'live_photo_video';
};

export interface CompiledBatchInput {
	requestAssets: V1UploadAsset[];
	files: FlatUploadFile[];
}

/**
 * Uppy file.meta 内需要维护的最小字段。
 */
export interface MediaUploadMeta {
	[key: string]: unknown;
	task_id: string;
	asset_id?: string;
	scene: V1MediaScene;
}

export type BatchProgressEvent = RealtimeBatchProgress;

export type HeaderFactory = () => Record<string, string> | Promise<Record<string, string>>;

export interface CreateMediaUploaderOptions {
	baseUrl?: string;
	getHeaders?: HeaderFactory;
	getToken?: () => string | undefined;
	deviceId?: string;
	uppyOptions?: ConstructorParameters<typeof Uppy<MediaUploadMeta, UploadBody>>[0];
	awsS3Options?: Partial<AwsS3MultipartOptions<MediaUploadMeta, UploadBody>>;
}

export interface MediaUploader {
	upload: (params: PrepareUploadParams) => Promise<string>;
	pauseAll: () => void;
	resumeAll: () => void;
	retryAll: () => Promise<UploadResult<MediaUploadMeta, UploadBody> | undefined>;
	cancelAll: () => void;
	getBatchMedia: (batchId: string) => Promise<V1MediaAsset[]>;
	subscribeBatchProgress: (
		batchId: string,
		listener: (event: BatchProgressEvent) => void
	) => () => void;
	clear: () => void;
	destroy: () => void;
	uppy: Uppy<MediaUploadMeta, UploadBody>;
}
