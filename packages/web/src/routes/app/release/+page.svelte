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
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { PlusIcon, XIcon } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { ConfirmDialog } from '$lib/components/custom/confirm-dialog';
	import { ReleaseCoverPreview } from '$lib/components/custom/release';
	import { toast } from 'svelte-sonner';
	import { TOAST_MESSAGES } from '$lib/constants/toast-messages';
	import {
		ShinRichTextarea,
		createFetchMentionUsersFromFollowings,
		extractContentFromShinRichTextarea
	} from '$lib/components/custom/shin-rich';
	import * as Select from '$lib/components/ui/select';
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
	import { formatTimeAccuracyFirst } from '$lib/utils/format-time';
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

	// 隐藏的文件 input 引用，由"+"按钮触发点击
	let mediaFileInputRef = $state<HTMLInputElement | null>(null);

	let selectedSectionLabel = $derived(
		partitionsLoading
			? '加载中...'
			: selectedSection
				? (partitions.find((p) => p.value === selectedSection)?.label ?? '请选择')
				: '请选择'
	);

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

	/** 用户点击"+"时触发隐藏文件 input 的点击。 */
	function handleAddMediaClick() {
		mediaFileInputRef?.click();
	}

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
		<!-- 图片/视频选择器 - 需求 6.2.5.1-2 -->
		<Label class="mt-6 text-lg font-bold">选择图片/视频</Label>
		<p class="text-sm text-muted-foreground">
			最多 {MAX_MEDIA_COUNT} 张，已选 {cachedMediaItems.length} 张
		</p>

		<!-- 隐藏文件 input：accept 同时支持图片和视频 -->
		<input
			bind:this={mediaFileInputRef}
			type="file"
			accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime,video/x-m4v,video/webm"
			multiple
			class="hidden"
			onchange={handleFileSelect}
		/>

		<div class="mt-3 flex flex-wrap gap-2">
			{#each cachedMediaItems as _, index (index)}
				<!-- 缩略图 + 删除按钮叠层 -->
				<div class="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
					<img
						src={cachedMediaUrls[index]}
						alt={`媒体 ${index + 1}`}
						class="h-full w-full object-cover"
						draggable="false"
					/>
					<!-- 删除按钮覆盖在右上角 -->
					<button
						class="absolute top-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-zinc-900/60 text-zinc-100 hover:bg-zinc-900/80"
						onclick={() => handleRemoveMedia(index)}
						aria-label="删除"
					>
						<XIcon class="size-3" />
					</button>
				</div>
			{/each}
			<!-- 仅在未达上限时显示添加按钮 -->
			{#if cachedMediaItems.length < MAX_MEDIA_COUNT}
				<button
					class="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-muted hover:bg-muted-foreground/10"
					onclick={handleAddMediaClick}
					aria-label="添加图片/视频"
				>
					<PlusIcon class="size-4 text-muted-foreground" />
				</button>
			{/if}
		</div>
		<!-- 正文内容：标题 20 字、描述 10000 字、@ 用户见 ShinRichTextarea -->
		<p class="mt-6 text-lg font-bold">正文内容</p>
		<div class="relative mt-2">
			<Input
				bind:value={titleContent}
				maxlength={titleWordLimit}
				placeholder="填写标题"
				class="pr-16"
			></Input>
			<div
				class="pointer-events-none absolute right-3 bottom-1/2 translate-y-1/2 text-muted-foreground"
			>
				{titleContent.length}/{titleWordLimit}
			</div>
		</div>
		{#key resetKey}
			<ShinRichTextarea
				placeholder="添加帖子描述"
				class="mt-5"
				bind:contentEditableRef={contenteditableRef}
				initialContent={initialBodyContent}
				{fetchMentionUsers}
				onMentionClick={(userId) => {
					// @ts-expect-error - /app/profile/[userId] 路由待个人资料模块实现
					goto(resolve(`/app/profile/${userId}`));
				}}
			/>
		{/key}

		<!-- 需求 6.2.5.1-4：分区选择必填，与管理-分区编辑同步 -->
		<p class="mt-6 text-lg font-bold">分区选择<span class="text-red-500">*</span></p>
		<div class="mt-2">
			{#if partitionsError}
				<p class="text-sm text-destructive">{partitionsError}</p>
			{:else if !partitionsLoading && partitions.length === 0}
				<p class="text-sm text-muted-foreground">
					暂无分区喵。但这怎么可能？如果你看到了这段文字，请联系开发人员。
				</p>
			{:else}
				<Select.Root
					type="single"
					name="section"
					bind:value={selectedSection}
					disabled={partitionsLoading}
				>
					<Select.Trigger class="min-w-31.5 text-sm">
						{selectedSectionLabel}
					</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each partitions as section (section.value)}
								<Select.Item value={section.value}>{section.label}</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			{/if}
		</div>
	</div>
	<!-- 底部按钮：需求 6.2.5.2 操作区 -->
	<!-- 保存：无变更时 toast、有变更持久化、1min 自动保存、显示「保存于/自动保存于 xx:xx」 -->
	<div class="flex gap-2 border-t border-zinc-100 p-4 font-medium">
		<ConfirmDialog onConfirm={handleReset} confirmText="重置">
			{#snippet trigger()}
				<Button
					variant="tertiary"
					class="cursor-pointer text-muted-foreground"
					disabled={isUploading}>重置</Button
				>
			{/snippet}
			{#snippet description()}
				<p>
					确定要重置吗？
					<br />
					编辑的内容将会丢失
				</p>
			{/snippet}
		</ConfirmDialog>
		<ConfirmDialog
			bind:open={showLeaveConfirm}
			onConfirm={handleLeaveConfirm}
			onCancel={handleLeaveCancel}
			confirmText="退出"
		>
			{#snippet description()}
				<p>有未保存的变更，是否退出编辑？<br />退出前将自动保存。</p>
			{/snippet}
		</ConfirmDialog>
		<ConfirmDialog bind:open={showPublishConfirm} onConfirm={handleSubmit} confirmText="发布">
			{#snippet description()}
				<p>确定要发布这篇帖子吗？<br />发布后将立即对所有人可见。</p>
			{/snippet}
		</ConfirmDialog>
		<Button
			variant="tertiary"
			class="cursor-pointer text-muted-foreground"
			onclick={handleSave}
			disabled={isUploading}>保存</Button
		>

		{#if isUploading}
			<!-- 上传中：显示进度 + 取消按钮 -->
			<!-- TODO(6.2.5.4-1): 完整实现需求中的 App 横幅通知进度条（等横幅通知组件就绪后替换） -->
			<div class="flex flex-1 items-center gap-3">
				<span class="text-sm text-muted-foreground">
					上传中 {uploadProgress.uploadedFiles}/{uploadProgress.totalFiles}…
				</span>
				<ConfirmDialog onConfirm={handleCancelUpload} confirmText="取消上传">
					{#snippet trigger()}
						<Button variant="tertiary" class="cursor-pointer text-destructive">取消</Button>
					{/snippet}
					{#snippet description()}
						<p>确定要取消上传吗？已上传的内容将被清理。</p>
					{/snippet}
				</ConfirmDialog>
			</div>
		{:else}
			<Button
				variant="default"
				class="flex-1 cursor-pointer transition-none lg:flex-none"
				onclick={handlePublishClick}>发布帖子</Button
			>
		{/if}

		{#if lastSaved && !isUploading}
			<div class="mx-4 flex items-center text-sm text-muted-foreground">
				{lastSavedIsAutoSave ? '自动保存于 ' : '保存于 '}
				{formatTimeAccuracyFirst(lastSaved)}
			</div>
		{/if}
	</div>
</main>
