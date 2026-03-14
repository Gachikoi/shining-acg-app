/**
 * 发布页草稿持久化
 * 用于保存、加载、清除发布表单草稿
 * 需求 6.2.5.2-2：保存/自动保存后持久化，用户再次打开从缓存恢复
 * TODO(6.2.5.4-7): 取消上传时二次确认后清除缓存和已上传内容
 *
 * 草稿结构演进：schemaVersion 递增，新增字段时补充默认值填充；上线后如需迁移旧数据再引入迁移链。
 */
import { createDbCache } from '$lib/modules/cache';
import type { V1PostContentUnit } from '$lib/api/types.gen';
import {
	DEFAULT_TEXT_COVER_STYLE_ID,
	getTextCoverRenderer,
	type TextCoverStyleId
} from '$lib/modules/media-cover';

const DEFAULT_DRAFT_ID = 'release-draft';

/** 当前草稿 schema 版本，新增字段时递增并补充默认值填充。 */
export const RELEASE_DRAFT_SCHEMA_VERSION = 2;

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
	/** 草稿结构版本，用于标识与默认值填充。 */
	schemaVersion: number;
	/** 文字封面样式 ID，未设置或非法时回退 default。 */
	textCoverStyleId: TextCoverStyleId;
}

// 草稿无需 TTL，应永久保留直到用户显式清除或发布完成
const draftCache = createDbCache<ReleaseDraft>('release-draft', {
	dbName: 'shining-app-release-draft'
});

export async function saveReleaseDraft(draft: ReleaseDraft): Promise<void> {
	await draftCache.set(draft.id, draft);
}

/**
 * 归一化草稿：非法 textCoverStyleId 回退 default。
 * 白名单校验保证运行时安全，避免未注册样式导致 resolveCoverBlob 抛错。
 */
function normalizeDraft(draft: ReleaseDraft): ReleaseDraft {
	const styleId = draft.textCoverStyleId;
	const isValid =
		typeof styleId === 'string' &&
		styleId.length > 0 &&
		getTextCoverRenderer(styleId) !== undefined;
	return {
		...draft,
		textCoverStyleId: isValid ? styleId : DEFAULT_TEXT_COVER_STYLE_ID
	};
}

export async function loadReleaseDraft(
	id: string = DEFAULT_DRAFT_ID
): Promise<ReleaseDraft | null> {
	const raw = await draftCache.get(id);
	if (!raw) return null;
	try {
		const obj = raw as unknown as Record<string, unknown>;
		const schemaVersionFilled = typeof obj.schemaVersion !== 'number';
		const withDefaults: ReleaseDraft = {
			...obj,
			schemaVersion: schemaVersionFilled ? RELEASE_DRAFT_SCHEMA_VERSION : obj.schemaVersion,
			textCoverStyleId:
				typeof obj.textCoverStyleId === 'string' && obj.textCoverStyleId.length > 0
					? obj.textCoverStyleId
					: DEFAULT_TEXT_COVER_STYLE_ID
		} as ReleaseDraft;
		const normalized = normalizeDraft(withDefaults);
		const styleIdFixed = normalized.textCoverStyleId !== withDefaults.textCoverStyleId;
		if (schemaVersionFilled || styleIdFixed) {
			await draftCache.set(id, normalized);
		}
		return normalized;
	} catch (error) {
		console.warn('[release-draft] 草稿加载失败，跳过恢复:', error);
		return null;
	}
}

export async function clearReleaseDraft(id: string = DEFAULT_DRAFT_ID): Promise<void> {
	await draftCache.delete(id);
}
