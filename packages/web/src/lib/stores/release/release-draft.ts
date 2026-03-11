/**
 * 发布页草稿持久化
 * 用于保存、加载、清除发布表单草稿
 * 需求 6.2.5.2-2：保存/自动保存后持久化，用户再次打开从缓存恢复
 * TODO(6.2.5.4-7): 取消上传时二次确认后清除缓存和已上传内容
 */
import { createDbCache } from '$lib/modules/cache';
import type { V1PostContentUnit } from '$lib/api/types.gen';

const DEFAULT_DRAFT_ID = 'release-draft';

/** 封面比例，与发布页 UI 共用 */
export const CoverRatioArray = ['1:1', '4:3', '3:4'] as const;
export type CoverRatio = (typeof CoverRatioArray)[number];

/** 草稿媒体项，支持 single 与 live_photo */
export type DraftMediaItem =
	| { kind: 'single'; blob: Blob; name: string }
	| {
			kind: 'live_photo';
			imageBlob: Blob;
			videoBlob: Blob;
			imageName: string;
			videoName: string;
	  };

export interface ReleaseDraft {
	id: string;
	updatedAt: string;
	isAutoSave: boolean;
	title: string;
	bodyContent: V1PostContentUnit[];
	selectedSection: string;
	coverRatio: CoverRatio;
	/** 封面对应 mediaItems 的索引 */
	selectedCoverIndex: number;
	mediaItems: DraftMediaItem[];
}

// 草稿无需 TTL，应永久保留直到用户显式清除或发布完成
const draftCache = createDbCache<ReleaseDraft>('release-draft', {
	dbName: 'shining-app-release-draft'
});

export async function saveReleaseDraft(draft: ReleaseDraft): Promise<void> {
	await draftCache.set(draft.id, draft);
}

export async function loadReleaseDraft(
	id: string = DEFAULT_DRAFT_ID
): Promise<ReleaseDraft | null> {
	return draftCache.get(id);
}

export async function clearReleaseDraft(id: string = DEFAULT_DRAFT_ID): Promise<void> {
	await draftCache.delete(id);
}
