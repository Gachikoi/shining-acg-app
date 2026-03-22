/**
 * 发布页编辑器核心：媒体条带、封面比例/文字样式、封面预览解析与 Object URL 生命周期。
 */
import { toast } from 'svelte-sonner';
import { TOAST_MESSAGES } from '$lib/constants/toast-messages';
import type { V1PostContentUnit } from '$lib/api/types.gen';
import {
	DEFAULT_TEXT_COVER_STYLE_ID,
	getPreviewBlobForDisplay,
	isImageItem,
	isVideoItem,
	PLACEHOLDER_VIDEO_FAILED,
	PLACEHOLDER_VIDEO_LOADING,
	resolveCoverBlob,
	type CoverSource
} from '$lib/modules/media-cover';
import { filesToDraftItems, getPreviewBlob } from '$lib/modules/release-media';
import { formatUploadError } from '$lib/utils/format-upload-error';
import { CoverRatioArray, type CoverRatio, type DraftMediaItem } from './release-draft.js';

/** 需求 6.2.5.1-2：帖子媒体上限 */
const MAX_MEDIA_COUNT = 20;

/** `createReleaseEditorCore` 的依赖注入：页面提供标题/正文/DOM ref，以便 runes 正确追踪依赖 */
export type ReleaseEditorCoreOptions = {
	defaultCoverRatio: CoverRatio;
	/** 须读取页面上的响应式标题，供封面与 effect 依赖追踪 */
	getTitle: () => string;
	/** 挂载前用草稿正文、挂载后用富文本提取结果，与历史 buildDraft 语义一致 */
	getBodyContent: () => V1PostContentUnit[];
	/** 富文本根元素；用于挂载 `input` 监听以驱动无媒体文字封面重算 */
	getContenteditableRef: () => HTMLDivElement | null;
	/** 草稿正文的初始单元数，用于草稿加载后触发文字封面重算 */
	getInitialBodyUnitsLength: () => number;
};

/**
 * 创建发布页「媒体 + 封面预览」状态：含选文件、缩略图 URL、封面比例与文字样式、防抖解析预览。
 *
 * @param options - 来自页面的 getter，须在调用时读取最新的 runes 状态
 * @returns 响应式字段与操作方法；路由卸载时必须调用 `destroy()`
 */
export function createReleaseEditorCore(options: ReleaseEditorCoreOptions) {
	let cachedMediaItems = $state<DraftMediaItem[]>([]);
	let cachedMediaUrls = $state<string[]>([]);
	let selectedCoverIndex = $state(0);
	let coverRatio = $state<CoverRatio>(options.defaultCoverRatio);
	let textCoverStyleId = $state(DEFAULT_TEXT_COVER_STYLE_ID);
	let coverPreviewUrl = $state<string | null>(null);
	let coverSource = $state<CoverSource>('text-generated');
	let isCoverResolving = $state(false);
	/** 正文 input 次数计数，驱动「无媒体文字封面」effect 而不对正文做深比较 */
	let coverBodyInputVersion = $state(0);
	/** 与防抖定时器配合：递增后旧的一次 resolveCoverBlob 结果不得覆盖新状态 */
	let coverResolveSeq = 0;
	let coverResolveTimer: ReturnType<typeof setTimeout> | null = null;

	/** 释放当前封面预览 object URL 并清空状态 */
	function clearCoverPreviewUrl(): void {
		if (coverPreviewUrl) {
			URL.revokeObjectURL(coverPreviewUrl);
			coverPreviewUrl = null;
		}
	}

	/**
	 * 用新 Blob 生成预览 URL，并 revoke 上一张避免泄漏
	 *
	 * @param nextBlob - `resolveCoverBlob` 返回的封面图像
	 */
	function replaceCoverPreviewUrl(nextBlob: Blob): void {
		const nextUrl = URL.createObjectURL(nextBlob);
		clearCoverPreviewUrl();
		coverPreviewUrl = nextUrl;
	}

	/**
	 * 按当前媒体/标题/正文等调用 `resolveCoverBlob`，并处理防抖与并发 token
	 *
	 * @param delayMs - 有媒体时常为 `0`；纯文字封面为 `250` 以降低 canvas 重绘频率
	 */
	async function resolveCoverPreview(delayMs: number): Promise<void> {
		const token = ++coverResolveSeq;
		if (coverResolveTimer) {
			clearTimeout(coverResolveTimer);
			coverResolveTimer = null;
		}
		await new Promise<void>((resolve) => {
			coverResolveTimer = setTimeout(
				() => {
					coverResolveTimer = null;
					resolve();
				},
				Math.max(0, delayMs)
			);
		});
		if (token !== coverResolveSeq) return;

		isCoverResolving = true;
		try {
			// await 前后都核对 token，覆盖用户快速切换比例/媒体时的竞态
			const { blob, source } = await resolveCoverBlob({
				mediaItems: cachedMediaItems,
				selectedCoverIndex,
				ratio: coverRatio,
				title: options.getTitle(),
				content: options.getBodyContent(),
				textCoverStyleId
			});
			if (token !== coverResolveSeq) return;
			replaceCoverPreviewUrl(blob);
			coverSource = source;
		} catch (error) {
			console.error('Resolve cover preview failed:', error);
			if (token !== coverResolveSeq) return;
			clearCoverPreviewUrl();
			coverSource = 'text-generated';
		} finally {
			if (token === coverResolveSeq) {
				isCoverResolving = false;
			}
		}
	}

	/** 按 `CoverRatioArray` 循环切换封面比例（如 1:1 → 4:3 → 3:4） */
	function rotateCoverRatio(): void {
		const currentIndex = CoverRatioArray.indexOf(coverRatio);
		const nextIndex = (currentIndex + 1) % CoverRatioArray.length;
		coverRatio = CoverRatioArray[nextIndex];
	}

	/**
	 * 处理隐藏 file input 的 `change`：解析 Live Photo、追加草稿项并生成预览 URL
	 *
	 * @param e - 来自 `<input type="file">` 的事件
	 */
	function handleFileSelect(e: Event): void {
		const input = e.currentTarget as HTMLInputElement;
		const newFiles = Array.from(input.files ?? []);
		if (!newFiles.length) return;

		const remaining = MAX_MEDIA_COUNT - cachedMediaItems.length;
		if (remaining <= 0) {
			toast.error(`最多只能选择 ${MAX_MEDIA_COUNT} 张图片/视频`);
			input.value = '';
			return;
		}

		try {
			const newItems = filesToDraftItems(newFiles, 'MEDIA_SCENE_POST_MEDIA');
			const toAdd = newItems.slice(0, remaining);
			if (newItems.length > remaining) {
				toast.warning(`已达到 ${MAX_MEDIA_COUNT} 张上限，仅添加了前 ${remaining} 个文件`);
			}
			const baseIndex = cachedMediaItems.length;
			cachedMediaItems = [...cachedMediaItems, ...toAdd];
			const initialUrls = toAdd.map((item) =>
				isImageItem(item)
					? URL.createObjectURL(getPreviewBlob(item))
					: isVideoItem(item)
						? PLACEHOLDER_VIDEO_LOADING
						: URL.createObjectURL(getPreviewBlob(item))
			);
			cachedMediaUrls = [...cachedMediaUrls, ...initialUrls];

			let hasFailed = false;
			toAdd.forEach((item, i) => {
				if (!isVideoItem(item)) return;
				const idx = baseIndex + i;
				getPreviewBlobForDisplay(item)
					.then((blob) => URL.createObjectURL(blob))
					.then((url) => {
						cachedMediaUrls = cachedMediaUrls.map((u, j) => (j === idx ? url : u));
					})
					.catch(() => {
						cachedMediaUrls = cachedMediaUrls.map((u, j) =>
							j === idx ? PLACEHOLDER_VIDEO_FAILED : u
						);
						if (!hasFailed) {
							hasFailed = true;
							toast.error(TOAST_MESSAGES.VIDEO_THUMBNAIL_FAILED);
						}
					});
			});
		} catch (err) {
			toast.error(formatUploadError(err) || '文件解析失败');
		}

		input.value = '';
	}

	/**
	 * 移除指定索引的媒体项，revoke 对应 object URL，并修正 `selectedCoverIndex`
	 *
	 * @param index - `cachedMediaItems` 中的下标
	 */
	function handleRemoveMedia(index: number): void {
		URL.revokeObjectURL(cachedMediaUrls[index]);
		cachedMediaItems = cachedMediaItems.filter((_, i) => i !== index);
		cachedMediaUrls = cachedMediaUrls.filter((_, i) => i !== index);
		if (selectedCoverIndex === index) {
			selectedCoverIndex = 0;
		} else if (selectedCoverIndex > index) {
			selectedCoverIndex -= 1;
		}
	}

	/**
	 * 将 `cachedMediaItems` / `cachedMediaUrls` 中的一项从 `fromIndex` 移到 `toIndex`（同序 splice）
	 *
	 * @param fromIndex - 被拖动项当前下标
	 * @param toIndex - 插入位置下标（与 `Array.splice` 语义一致：先移除再插入）
	 *
	 * @remarks
	 * - `fromIndex === toIndex` 或越界时立即返回，不修改状态。
	 * - `selectedCoverIndex` 随重排平移：若封面项被移动则指向新下标；其余项在跨越区间时增减。
	 * - 会触发既有 `$effect`，进而重算封面预览（与 `handleRemoveMedia` 同类索引维护）。
	 */
	function reorderMedia(fromIndex: number, toIndex: number): void {
		if (fromIndex === toIndex) return;
		const n = cachedMediaItems.length;
		if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n) return;

		const nextItems = [...cachedMediaItems];
		const nextUrls = [...cachedMediaUrls];
		const [movedItem] = nextItems.splice(fromIndex, 1);
		const [movedUrl] = nextUrls.splice(fromIndex, 1);
		nextItems.splice(toIndex, 0, movedItem);
		nextUrls.splice(toIndex, 0, movedUrl);
		cachedMediaItems = nextItems;
		cachedMediaUrls = nextUrls;

		let s = selectedCoverIndex;
		if (s === fromIndex) {
			s = toIndex;
		} else if (fromIndex < toIndex) {
			if (s > fromIndex && s <= toIndex) {
				s -= 1;
			}
		} else if (s >= toIndex && s < fromIndex) {
			s += 1;
		}
		selectedCoverIndex = s;
	}

	/**
	 * 从持久化草稿恢复媒体列表、封面索引与比例/文字样式；先回收当前列表的 object URL
	 *
	 * @param draft.mediaItems - IndexedDB 恢复的 Blob 项
	 * @param draft.selectedCoverIndex - 草稿中记录的封面下标
	 * @param draft.coverRatio - 草稿中的封面比例
	 * @param draft.textCoverStyleId - 文字封面样式，缺省则用默认样式
	 */
	function hydrateFromDraftMedia(draft: {
		mediaItems: DraftMediaItem[];
		selectedCoverIndex: number;
		coverRatio: CoverRatio;
		textCoverStyleId?: string;
	}): void {
		for (const url of cachedMediaUrls) {
			URL.revokeObjectURL(url);
		}
		const items = draft.mediaItems ?? [];
		cachedMediaItems = [...items];
		cachedMediaUrls = items.map((item) =>
			isImageItem(item)
				? URL.createObjectURL(getPreviewBlob(item))
				: isVideoItem(item)
					? PLACEHOLDER_VIDEO_LOADING
					: URL.createObjectURL(getPreviewBlob(item))
		);
		selectedCoverIndex =
			cachedMediaItems.length === 0
				? 0
				: Math.min(draft.selectedCoverIndex ?? 0, cachedMediaItems.length - 1);
		coverRatio = draft.coverRatio;
		textCoverStyleId = draft.textCoverStyleId ?? DEFAULT_TEXT_COVER_STYLE_ID;

		let hasFailed = false;
		// 视频项：与 handleFileSelect 相同，先占位再异步替换为首帧 object URL
		items.forEach((item, idx) => {
			if (!isVideoItem(item)) return;
			getPreviewBlobForDisplay(item)
				.then((blob) => URL.createObjectURL(blob))
				.then((url) => {
					cachedMediaUrls = cachedMediaUrls.map((u, j) => (j === idx ? url : u));
				})
				.catch(() => {
					cachedMediaUrls = cachedMediaUrls.map((u, j) =>
						j === idx ? PLACEHOLDER_VIDEO_FAILED : u
					);
					if (!hasFailed) {
						hasFailed = true;
						toast.error(TOAST_MESSAGES.VIDEO_THUMBNAIL_FAILED);
					}
				});
		});
	}

	/** 清空媒体与封面预览，恢复默认比例与文字样式（页面「重置」时调用） */
	function resetMediaAndCover(): void {
		for (const url of cachedMediaUrls) {
			URL.revokeObjectURL(url);
		}
		clearCoverPreviewUrl();
		coverRatio = options.defaultCoverRatio;
		textCoverStyleId = DEFAULT_TEXT_COVER_STYLE_ID;
		cachedMediaItems = [];
		cachedMediaUrls = [];
		selectedCoverIndex = 0;
	}

	/** 清除防抖定时器并 revoke 所有媒体与封面 object URL；须在页面 `onDestroy` 中调用 */
	function destroy(): void {
		if (coverResolveTimer) {
			clearTimeout(coverResolveTimer);
			coverResolveTimer = null;
		}
		for (const url of cachedMediaUrls) {
			URL.revokeObjectURL(url);
		}
		clearCoverPreviewUrl();
	}

	$effect(() => {
		if (cachedMediaItems.length > 0 && selectedCoverIndex >= cachedMediaItems.length) {
			selectedCoverIndex = 0;
		}
	});

	$effect(() => {
		const editable = options.getContenteditableRef();
		if (!editable) return;
		/** 正文变更时推高版本号，避免对富文本做深比较即可触发文字封面重算 */
		const onInput = () => {
			coverBodyInputVersion += 1;
		};
		editable.addEventListener('input', onInput);
		return () => {
			editable.removeEventListener('input', onInput);
		};
	});

	$effect(() => {
		const mediaCount = cachedMediaItems.length;
		const coverIndex = selectedCoverIndex;
		const ratio = coverRatio;
		if (mediaCount >= 0 && coverIndex >= 0 && ratio.length > 0) {
			void resolveCoverPreview(0);
		}
	});

	$effect(() => {
		const mediaCount = cachedMediaItems.length;
		const textTrigger = `${options.getTitle().length}:${coverBodyInputVersion}:${coverRatio}:${textCoverStyleId}:${options.getInitialBodyUnitsLength()}`;
		// textTrigger 仅用于收集依赖；length >= 0 恒真。无媒体时防抖重算文字封面
		if (mediaCount === 0 && textTrigger.length >= 0) {
			void resolveCoverPreview(250);
		}
	});

	return {
		/** 需求 6.2.5.1-2：可选媒体张数上限 */
		get maxMediaCount() {
			return MAX_MEDIA_COUNT;
		},
		/** 当前草稿媒体项（含 Blob），用于上传与持久化 */
		get cachedMediaItems() {
			return cachedMediaItems;
		},
		/** 与 `cachedMediaItems` 一一对应的预览 URL（含视频占位与 object URL） */
		get cachedMediaUrls() {
			return cachedMediaUrls;
		},
		/** 作为封面的媒体在列表中的索引 */
		get selectedCoverIndex() {
			return selectedCoverIndex;
		},
		/** @param v - 作为封面的媒体在 `cachedMediaItems` 中的下标 */
		set selectedCoverIndex(v: number) {
			selectedCoverIndex = v;
		},
		/** 当前封面裁切比例 */
		get coverRatio() {
			return coverRatio;
		},
		/** 无媒体时文字封面的样式 id */
		get textCoverStyleId() {
			return textCoverStyleId;
		},
		/** 封面预览图 object URL，无则 null */
		get coverPreviewUrl() {
			return coverPreviewUrl;
		},
		/** 封面来源语义，供 `ReleaseCoverPreview` 展示 */
		get coverSource() {
			return coverSource;
		},
		/** 是否正在执行 `resolveCoverBlob` */
		get isCoverResolving() {
			return isCoverResolving;
		},
		rotateCoverRatio,
		handleFileSelect,
		handleRemoveMedia,
		reorderMedia,
		hydrateFromDraftMedia,
		resetMediaAndCover,
		destroy
	};
}

/** `createReleaseEditorCore` 的返回类型：含状态 getter 与封面/媒体操作 */
export type ReleaseEditorCore = ReturnType<typeof createReleaseEditorCore>;
