<script module lang="ts">
	// 常量定义
	// 参考产品需求文档 6.2.5 发布 (Release)
	import { CoverRatioArray, type CoverRatio } from '$lib/stores/release';

	const defaultCoverRatio: CoverRatio = '3:4';

	const titleWordLimit = 20; // 标题字数限制，需求 6.2.5.1-3：最大 20 个字符
</script>

<script lang="ts">
	/**
	 * 发布页 - 产品需求 6.2.5
	 * TODO(6.2.5.4-9): iOS/Android Webview 保活，保障应用在后台时也能处理、上传图片视频
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { ReleaseCoverPreview } from '$lib/components/custom/release';
	import { toast } from 'svelte-sonner';
	import { TOAST_MESSAGES } from '$lib/constants/toast-messages';
	import {
		createFetchMentionUsersFromFollowings,
		extractContentFromShinRichTextarea
	} from '$lib/components/custom/shin-rich';
	import ReleaseMediaPicker from './components/release-media-picker.svelte';
	import ReleaseBodySection from './components/release-body-section.svelte';
	import ReleasePartitionSelect from './components/release-partition-select.svelte';
	import ReleaseActionBar from './components/release-action-bar.svelte';
	import { partitionServiceListPartitions, postServiceCreatePost } from '$lib/api';
	import type { V1PostContentUnit } from '$lib/api/types.gen';
	import {
		RELEASE_DRAFT_SCHEMA_VERSION,
		saveReleaseDraft,
		loadReleaseDraft,
		clearReleaseDraft,
		type DraftMediaItem,
		type ReleaseDraft
	} from '$lib/stores/release';
	import {
		filesToDraftItems,
		draftItemsToPrepareParams,
		getPreviewBlob,
		mediaItemsEqual
	} from '$lib/modules/release-media';
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
	import { formatUploadError } from '$lib/utils/format-upload-error';
	import { resolve } from '$app/paths';
	import { createMediaUploader } from '$lib/modules/media-uploader';
	import type { MediaUploader } from '$lib/modules/media-uploader';

	const DRAFT_ID = 'release-draft';
	const fetchMentionUsers = createFetchMentionUsersFromFollowings();

	let lastSaved = $state<string | null>(null);
	let lastSavedIsAutoSave = $state(false);
	let lastSavedSnapshot = $state<ReleaseDraft | null>(null);

	let cachedMediaItems = $state<DraftMediaItem[]>([]);
	let cachedMediaUrls = $state<string[]>([]);
	let selectedCoverIndex = $state(0);
	let coverRatio = $state<CoverRatio>(defaultCoverRatio);
	let textCoverStyleId = $state(DEFAULT_TEXT_COVER_STYLE_ID);
	let coverPreviewUrl = $state<string | null>(null);
	let coverSource = $state<CoverSource>('text-generated');
	let isCoverResolving = $state(false);
	let coverBodyInputVersion = $state(0);
	let coverResolveSeq = 0;
	let coverResolveTimer: ReturnType<typeof setTimeout> | null = null;
	let titleContent = $state('');
	let contenteditableRef = $state<HTMLDivElement | null>(null);
	let initialBodyContent = $state<V1PostContentUnit[] | undefined>(undefined);

	let partitions = $state<Array<{ value: string; label: string }>>([]);
	let partitionsLoading = $state(true);
	let partitionsError = $state<string | null>(null);
	let selectedSection = $state('');

	let showLeaveConfirm = $state(false);
	let pendingNavigationUrl = $state<URL | null>(null);
	let resetKey = $state(0);
	let showPublishConfirm = $state(false);

	// 上传状态
	let isUploading = $state(false);
	let uploadProgress = $state<{ uploadedFiles: number; totalFiles: number }>({
		uploadedFiles: 0,
		totalFiles: 0
	});
	let mediaUploader = $state<MediaUploader | null>(null);
	let uploadCancelled = $state(false);

	function buildDraft(isAutoSave: boolean): ReleaseDraft {
		const clampedCoverIndex =
			cachedMediaItems.length === 0 ? 0 : Math.min(selectedCoverIndex, cachedMediaItems.length - 1);
		return {
			id: DRAFT_ID,
			updatedAt: new Date().toISOString(),
			isAutoSave,
			title: titleContent,
			bodyContent: contenteditableRef ? extractContentFromShinRichTextarea(contenteditableRef) : [],
			selectedSection,
			coverRatio,
			selectedCoverIndex: clampedCoverIndex,
			mediaItems: [...cachedMediaItems],
			schemaVersion: RELEASE_DRAFT_SCHEMA_VERSION,
			textCoverStyleId
		};
	}

	function draftsEqual(a: ReleaseDraft, b: ReleaseDraft): boolean {
		return (
			a.title === b.title &&
			a.selectedSection === b.selectedSection &&
			a.coverRatio === b.coverRatio &&
			a.selectedCoverIndex === b.selectedCoverIndex &&
			a.textCoverStyleId === b.textCoverStyleId &&
			JSON.stringify(a.bodyContent) === JSON.stringify(b.bodyContent) &&
			mediaItemsEqual(a.mediaItems, b.mediaItems)
		);
	}

	function isDirty(): boolean {
		if (!lastSavedSnapshot) return true;
		return !draftsEqual(buildDraft(false), lastSavedSnapshot);
	}

	async function performSave(isAutoSave: boolean) {
		const draft = buildDraft(isAutoSave);
		const snapshot = $state.snapshot(draft);
		await saveReleaseDraft(snapshot);
		lastSaved = draft.updatedAt;
		lastSavedIsAutoSave = isAutoSave;
		lastSavedSnapshot = snapshot;
	}

	function handleSave() {
		if (!isDirty()) {
			toast.info(TOAST_MESSAGES.NO_CHANGES_TO_SAVE);
			return;
		}
		performSave(false);
	}

	function handleReset() {
		// TODO(6.2.5.2-1): 区分新建/编辑——编辑现有帖子时应重置为现网内容，而非清空
		for (const url of cachedMediaUrls) {
			URL.revokeObjectURL(url);
		}
		clearCoverPreviewUrl();
		titleContent = '';
		coverRatio = defaultCoverRatio;
		textCoverStyleId = DEFAULT_TEXT_COVER_STYLE_ID;
		cachedMediaItems = [];
		cachedMediaUrls = [];
		selectedCoverIndex = 0;
		selectedSection = '';
		initialBodyContent = [];
		lastSaved = null;
		lastSavedSnapshot = null;
		resetKey += 1;
		clearReleaseDraft(DRAFT_ID);
	}

	// 封面比例轮换
	function rotateCoverRatio() {
		const currentIndex = CoverRatioArray.indexOf(coverRatio);
		const nextIndex = (currentIndex + 1) % CoverRatioArray.length;
		coverRatio = CoverRatioArray[nextIndex];
	}

	// ── 图片/视频选择器 ────────────────────────────────────────────────

	const MAX_MEDIA_COUNT = 20; // 需求 6.2.5.1-2：最多 20 张

	/** 处理文件选择，解析 Live Photo 并转为 DraftMediaItem 追加。视频项先显示骨架屏，异步抽取首帧后更新。 */
	function handleFileSelect(e: Event) {
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

	/** 删除指定索引的媒体，revoke URL 并同步更新 selectedCoverIndex。 */
	function handleRemoveMedia(index: number) {
		URL.revokeObjectURL(cachedMediaUrls[index]);
		cachedMediaItems = cachedMediaItems.filter((_, i) => i !== index);
		cachedMediaUrls = cachedMediaUrls.filter((_, i) => i !== index);
		if (selectedCoverIndex === index) {
			selectedCoverIndex = 0;
		} else if (selectedCoverIndex > index) {
			selectedCoverIndex -= 1;
		}
	}

	// ── 上传 & 发布流程 ────────────────────────────────────────────────

	/**
	 * 确认发布后执行：上传媒体文件，然后调用 CreatePost。
	 * 需求 6.2.5.4：用户确认发布后才开始真正上传。
	 */
	async function handleSubmit() {
		showPublishConfirm = false;

		if (cachedMediaItems.length === 0) {
			await doCreatePost([], '');
			return;
		}

		if (!mediaUploader) {
			toast.error(TOAST_MESSAGES.UPLOAD_ERROR_RETRY);
			return;
		}

		const params = draftItemsToPrepareParams(cachedMediaItems, 'MEDIA_SCENE_POST_MEDIA');
		const totalFiles = params.reduce((sum, p) => sum + (p.kind === 'single' ? 1 : 2), 0);

		isUploading = true;
		uploadCancelled = false;
		uploadProgress = { uploadedFiles: 0, totalFiles };

		let completedCount = 0;
		const handleUploadSuccess = () => {
			completedCount += 1;
			uploadProgress = { uploadedFiles: completedCount, totalFiles };
		};

		try {
			const batchId = await mediaUploader.upload(params);
			if (uploadCancelled) return;

			mediaUploader.uppy.on('upload-success', handleUploadSuccess);

			await mediaUploader.uppy.upload();
			mediaUploader.uppy.off('upload-success', handleUploadSuccess);

			if (uploadCancelled) return;

			const mediaAssets = await mediaUploader.getBatchMedia(batchId);
			await doCreatePost(mediaAssets, batchId);
		} catch (error) {
			if (!uploadCancelled) {
				toast.error(formatUploadError(error) || TOAST_MESSAGES.UPLOAD_ERROR_RETRY);
			}
		} finally {
			isUploading = false;
		}
	}

	/** 调用 CreatePost 接口，成功后清草稿并跳转。 */
	async function doCreatePost(
		mediaAssets: import('$lib/api/types.gen').V1MediaAsset[],
		batchId: string
	) {
		try {
			await postServiceCreatePost({
				body: {
					batchId: mediaAssets.length > 0 ? batchId : '',
					title: titleContent || undefined,
					content: contenteditableRef
						? extractContentFromShinRichTextarea(contenteditableRef)
						: undefined,
					partitionId: selectedSection,
					mediaAssets
				},
				throwOnError: true
			});
			clearReleaseDraft(DRAFT_ID);
			toast.success(TOAST_MESSAGES.POST_PUBLISHED_SUCCESS);
			// TODO(6.2.5.4): 发布成功后跳转到帖子详情页或 feed，等路由就绪后补充
			goto('/');
		} catch (error) {
			toast.error(formatUploadError(error) || TOAST_MESSAGES.UPLOAD_ERROR_RETRY);
		}
	}

	/** 用户主动取消上传。 */
	function handleCancelUpload() {
		uploadCancelled = true;
		mediaUploader?.cancelAll();
		isUploading = false;
		toast.info(TOAST_MESSAGES.UPLOAD_CANCELLED);
	}

	function handlePublishClick() {
		if (isUploading) return;
		if (!selectedSection) {
			toast.error(TOAST_MESSAGES.PLEASE_SELECT_PARTITION);
			return;
		}
		if (!validateForm()) {
			return;
		}
		showPublishConfirm = true;
	}

	function validateForm(): boolean {
		const hasContent =
			titleContent.trim().length > 0 ||
			(contenteditableRef && extractContentFromShinRichTextarea(contenteditableRef).length > 0) ||
			cachedMediaItems.length > 0;
		if (!hasContent) {
			toast.error(TOAST_MESSAGES.CONTENT_REQUIRED);
			return false;
		}
		return true;
	}

	// 需求 6.2.5.1-1：未设置封面时，以第 1 张图片或视频首帧作为封面
	// TODO(6.2.5.1-1): 视频首帧兜底、无图片/视频时用正文内容生成封面
	$effect(() => {
		if (cachedMediaItems.length > 0 && selectedCoverIndex >= cachedMediaItems.length) {
			selectedCoverIndex = 0;
		}
	});

	$effect(() => {
		const editable = contenteditableRef;
		if (!editable) return;
		// 正文变化频率高，单独维护一个版本号作为封面重算触发源。
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
		const textTrigger = `${titleContent.length}:${coverBodyInputVersion}:${coverRatio}:${textCoverStyleId}:${
			initialBodyContent?.length ?? 0
		}`;
		// 无媒体时才需要文字封面重算，并加防抖降低 canvas 重绘频率。
		if (mediaCount === 0 && textTrigger.length >= 0) {
			void resolveCoverPreview(250);
		}
	});

	// 获取分区列表
	$effect(() => {
		let cancelled = false;
		partitionsLoading = true;
		partitionsError = null;
		(async () => {
			try {
				const { data, error } = await partitionServiceListPartitions({ throwOnError: false });
				if (cancelled) return;
				if (error) {
					partitionsError = '加载分区列表失败';
					return;
				}
				partitions = (data?.partitions ?? [])
					.filter((p) => p?.id && p?.name)
					.map((p) => ({ value: p.id!, label: p.name! }));
			} finally {
				if (!cancelled) partitionsLoading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	onMount(() => {
		mediaUploader = createMediaUploader();

		// 加载草稿
		loadReleaseDraft(DRAFT_ID).then((draft) => {
			if (!draft) return;
			titleContent = draft.title;
			selectedSection = draft.selectedSection;
			coverRatio = draft.coverRatio as CoverRatio;
			textCoverStyleId = draft.textCoverStyleId ?? DEFAULT_TEXT_COVER_STYLE_ID;
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
			initialBodyContent = draft.bodyContent ?? [];
			lastSaved = draft.updatedAt;
			lastSavedIsAutoSave = draft.isAutoSave;
			lastSavedSnapshot = {
				...draft,
				mediaItems: draft.mediaItems ?? []
			};

			let hasFailed = false;
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
		});

		// 每 60s 自动保存
		const interval = setInterval(() => {
			if (isDirty()) {
				performSave(true);
			}
		}, 60_000);

		// 关闭标签页/刷新时弹窗提醒
		const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
			if (isDirty()) {
				e.preventDefault();
			}
		};
		window.addEventListener('beforeunload', beforeUnloadHandler);

		return () => {
			clearInterval(interval);
			window.removeEventListener('beforeunload', beforeUnloadHandler);
		};
	});

	// 需求 6.2.5.3 意外兜底：导航离开/关闭标签页时有未保存变更则二次确认，退出前自动保存
	beforeNavigate(({ to, cancel }) => {
		if (!isDirty()) return;
		if (!to?.url) return;
		cancel();
		pendingNavigationUrl = to.url;
		showLeaveConfirm = true;
	});

	async function handleLeaveConfirm() {
		if (pendingNavigationUrl) {
			await performSave(true);
			const url = pendingNavigationUrl;
			pendingNavigationUrl = null;
			showLeaveConfirm = false;
			// @ts-expect-error - url 不会是奇怪的东西
			const path = resolve(url.pathname + url.search + url.hash);
			goto(path);
		} else {
			showLeaveConfirm = false;
		}
	}

	function handleLeaveCancel() {
		pendingNavigationUrl = null;
		showLeaveConfirm = false;
	}

	onDestroy(() => {
		mediaUploader?.destroy();
		mediaUploader = null;
		if (coverResolveTimer) {
			clearTimeout(coverResolveTimer);
			coverResolveTimer = null;
		}
		for (const url of cachedMediaUrls) {
			URL.revokeObjectURL(url);
		}
		clearCoverPreviewUrl();
	});

	function getCurrentBodyContent(): V1PostContentUnit[] {
		if (contenteditableRef) {
			return extractContentFromShinRichTextarea(contenteditableRef);
		}
		return initialBodyContent ?? [];
	}

	function clearCoverPreviewUrl(): void {
		if (coverPreviewUrl) {
			URL.revokeObjectURL(coverPreviewUrl);
			coverPreviewUrl = null;
		}
	}

	function replaceCoverPreviewUrl(nextBlob: Blob): void {
		const nextUrl = URL.createObjectURL(nextBlob);
		clearCoverPreviewUrl();
		coverPreviewUrl = nextUrl;
	}

	async function resolveCoverPreview(delayMs: number): Promise<void> {
		// 递增 token：旧异步任务完成时不会覆盖最新封面结果。
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
			const { blob, source } = await resolveCoverBlob({
				mediaItems: cachedMediaItems,
				selectedCoverIndex,
				ratio: coverRatio,
				title: titleContent,
				content: getCurrentBodyContent(),
				textCoverStyleId
			});
			if (token !== coverResolveSeq) return;
			// URL 统一在 replace 内部替换并释放旧值，避免对象 URL 泄漏。
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
</script>

<main
	class="flex h-full flex-col rounded-2xl border-zinc-100 lg:mx-4 lg:h-[calc(100%-1rem)] lg:border"
>
	<div class="min-h-0 grow overflow-y-auto p-6">
		<!-- 封面设置文字 -->
		<p class="text-lg font-bold">
			封面设置
			<br class="lg:hidden" />
			<span class="text-sm font-normal text-muted-foreground">
				未设置封面时，以第 1
				张图片或视频首帧作为封面；若没有图片或视频，将会使用正文内容自动生成封面。
			</span>
		</p>
		<!-- 封面预览 -->
		<ReleaseCoverPreview
			ratio={coverRatio}
			coverUrl={coverPreviewUrl}
			source={coverSource}
			isLoading={isCoverResolving}
			onToggleRatio={rotateCoverRatio}
		/>
		<ReleaseMediaPicker
			items={cachedMediaItems}
			urls={cachedMediaUrls}
			maxCount={MAX_MEDIA_COUNT}
			onFileSelect={handleFileSelect}
			onRemove={handleRemoveMedia}
		/>
		<ReleaseBodySection
			bind:title={titleContent}
			bind:contenteditableRef
			{initialBodyContent}
			{resetKey}
			{titleWordLimit}
			{fetchMentionUsers}
			onMentionClick={(userId) => {
				// @ts-expect-error - /app/profile/[userId] 路由待个人资料模块实现
				goto(resolve(`/app/profile/${userId}`));
			}}
		/>
		<ReleasePartitionSelect
			{partitions}
			bind:selectedSection
			loading={partitionsLoading}
			error={partitionsError}
		/>
	</div>
	<ReleaseActionBar
		{isUploading}
		{uploadProgress}
		{lastSaved}
		{lastSavedIsAutoSave}
		bind:showLeaveConfirm
		bind:showPublishConfirm
		onReset={handleReset}
		onSave={handleSave}
		onPublishClick={handlePublishClick}
		onLeaveConfirm={handleLeaveConfirm}
		onLeaveCancel={handleLeaveCancel}
		onSubmit={handleSubmit}
		onCancelUpload={handleCancelUpload}
	/>
</main>
