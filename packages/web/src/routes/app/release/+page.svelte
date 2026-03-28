<script module lang="ts">
	// 常量定义
	// 参考产品需求文档 6.2.5 发布 (Release)
	import type { CoverRatio } from '$lib/stores/release';

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
	import ReleaseCoverPreview from './components/release-cover-preview.svelte';
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
	import { postServiceCreatePost } from '$lib/api';
	import type { V1PostContentUnit, V1MediaAsset } from '$lib/api/types.gen';
	import {
		RELEASE_DRAFT_SCHEMA_VERSION,
		saveReleaseDraft,
		loadReleaseDraft,
		clearReleaseDraft,
		type ReleaseDraft
	} from '$lib/stores/release';
	import { createReleasePartitions } from '$lib/stores/release/release-partitions.svelte.js';
	import { createReleaseEditorCore } from '$lib/stores/release/release-editor-core.svelte.js';
	import { createReleaseUploadController } from '$lib/stores/release/release-upload.svelte.js';
	import { scrollBoundary } from '$lib/modules/gesture';
	import { mediaItemsEqual } from '$lib/modules/release-media';
	import { formatUploadError } from '$lib/utils/format-upload-error';
	import { resolve } from '$app/paths';

	const DRAFT_ID = 'release-draft';
	const fetchMentionUsers = createFetchMentionUsersFromFollowings();

	// 分区列表 / 媒体与封面 / 上传：状态与副作用在对应 .svelte.ts 工厂内
	const partitionsState = createReleasePartitions();

	let titleContent = $state('');
	let contenteditableRef = $state<HTMLDivElement | null>(null);
	let initialBodyContent = $state<V1PostContentUnit[] | undefined>(undefined);
	let selectedSection = $state('');

	const editor = createReleaseEditorCore({
		defaultCoverRatio,
		getTitle: () => titleContent,
		getBodyContent: () => {
			if (contenteditableRef) {
				return extractContentFromShinRichTextarea(contenteditableRef);
			}
			return initialBodyContent ?? [];
		},
		getContenteditableRef: () => contenteditableRef,
		getInitialBodyUnitsLength: () => initialBodyContent?.length ?? 0
	});

	/**
	 * 调用 CreatePost：由 `createReleaseUploadController` 在上传结束或无媒体时触发
	 *
	 * @param mediaAssets - 已上传资源；纯文帖为空数组
	 * @param batchId - 上传批次；无媒体为空串
	 */
	async function completePublish(mediaAssets: V1MediaAsset[], batchId: string): Promise<void> {
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

	const upload = createReleaseUploadController({
		getDraftItems: () => editor.cachedMediaItems,
		completePublish
	});

	let lastSaved = $state<string | null>(null);
	let lastSavedIsAutoSave = $state(false);
	let lastSavedSnapshot = $state<ReleaseDraft | null>(null);

	let showLeaveConfirm = $state(false);
	let pendingNavigationUrl = $state<URL | null>(null);
	let resetKey = $state(0);
	let showPublishConfirm = $state(false);

	/**
	 * 拼装当前表单与 `editor` 状态的持久化快照
	 *
	 * @param isAutoSave - 是否记为自动保存（定时器为 true，手动保存为 false）
	 * @returns 可写入 IndexedDB 的 `ReleaseDraft`
	 */
	function buildDraft(isAutoSave: boolean): ReleaseDraft {
		const items = editor.cachedMediaItems;
		const clampedCoverIndex =
			items.length === 0 ? 0 : Math.min(editor.selectedCoverIndex, items.length - 1);
		return {
			id: DRAFT_ID,
			updatedAt: new Date().toISOString(),
			isAutoSave,
			title: titleContent,
			bodyContent: contenteditableRef ? extractContentFromShinRichTextarea(contenteditableRef) : [],
			selectedSection,
			coverRatio: editor.coverRatio,
			selectedCoverIndex: clampedCoverIndex,
			mediaItems: [...items],
			schemaVersion: RELEASE_DRAFT_SCHEMA_VERSION,
			textCoverStyleId: editor.textCoverStyleId
		};
	}

	/**
	 * 比较两份草稿是否一致（正文为 JSON 比较，媒体为 `mediaItemsEqual`）
	 *
	 * @param a - 通常来自 `buildDraft`
	 * @param b - 通常来自 `lastSavedSnapshot`
	 */
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

	/**
	 * 相对上次成功保存快照是否有未持久化变更；无快照视为脏
	 *
	 * @returns 是否需要提示保存或拦截离开
	 */
	function isDirty(): boolean {
		if (!lastSavedSnapshot) return true;
		return !draftsEqual(buildDraft(false), lastSavedSnapshot);
	}

	/**
	 * 将 `buildDraft` 写入 IndexedDB 并更新 `lastSaved` / 快照
	 *
	 * @param isAutoSave - 与草稿字段 `isAutoSave` 一致
	 */
	async function performSave(isAutoSave: boolean) {
		const draft = buildDraft(isAutoSave);
		const snapshot = $state.snapshot(draft);
		await saveReleaseDraft(snapshot);
		lastSaved = draft.updatedAt;
		lastSavedIsAutoSave = isAutoSave;
		lastSavedSnapshot = snapshot;
	}

	/** 手动保存：无变更时 toast 提示 */
	function handleSave() {
		if (!isDirty()) {
			toast.info(TOAST_MESSAGES.NO_CHANGES_TO_SAVE);
			return;
		}
		performSave(false);
	}

	/** 清空表单、媒体与本地草稿缓存，并递增 `resetKey` 以重建正文区 */
	function handleReset() {
		// TODO(6.2.5.2-1): 区分新建/编辑——编辑现有帖子时应重置为现网内容，而非清空
		editor.resetMediaAndCover();
		titleContent = '';
		selectedSection = '';
		initialBodyContent = [];
		lastSaved = null;
		lastSavedSnapshot = null;
		resetKey += 1;
		clearReleaseDraft(DRAFT_ID);
	}

	/** 确认发布弹窗确认后：关闭弹窗并委托 `upload.submit()` */
	async function handleSubmit() {
		showPublishConfirm = false;
		await upload.submit();
	}

	/** 底栏「重试上传」：委托 `upload.retry()` */
	function handleRetryUpload() {
		void upload.retry();
	}

	/** 底栏「删除失败项并继续」：委托 `upload.removeFailedAndProceed()` */
	function handleRemoveFailedAndProceed() {
		void upload.removeFailedAndProceed();
	}

	/** 底栏取消上传 */
	function handleCancelUpload() {
		upload.cancelUpload();
	}

	/**
	 * 点击发布：校验分区与表单后打开确认弹窗
	 */
	function handlePublishClick() {
		if (upload.isUploading) return;
		if (!selectedSection) {
			toast.error(TOAST_MESSAGES.PLEASE_SELECT_PARTITION);
			return;
		}
		if (!validateForm()) {
			return;
		}
		showPublishConfirm = true;
	}

	/**
	 * 校验标题、正文或媒体至少一项有内容
	 *
	 * @returns 是否通过校验（失败时已 toast）
	 */
	function validateForm(): boolean {
		const hasContent =
			titleContent.trim().length > 0 ||
			(contenteditableRef && extractContentFromShinRichTextarea(contenteditableRef).length > 0) ||
			editor.cachedMediaItems.length > 0;
		if (!hasContent) {
			toast.error(TOAST_MESSAGES.CONTENT_REQUIRED);
			return false;
		}
		return true;
	}

	onMount(() => {
		upload.init();

		loadReleaseDraft(DRAFT_ID).then((draft) => {
			if (!draft) return;
			titleContent = draft.title;
			selectedSection = draft.selectedSection;
			editor.hydrateFromDraftMedia({
				mediaItems: draft.mediaItems ?? [],
				selectedCoverIndex: draft.selectedCoverIndex ?? 0,
				coverRatio: draft.coverRatio,
				textCoverStyleId: draft.textCoverStyleId
			});
			initialBodyContent = draft.bodyContent ?? [];
			lastSaved = draft.updatedAt;
			lastSavedIsAutoSave = draft.isAutoSave;
			lastSavedSnapshot = {
				...draft,
				mediaItems: draft.mediaItems ?? []
			};
		});

		const interval = setInterval(() => {
			if (isDirty()) {
				performSave(true);
			}
		}, 60_000);

		/** 浏览器关闭/刷新前：有脏数据时触发原生离开提示 */
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

	// 需求 6.2.5.3：有未保存修改时拦截 SPA 导航并二次确认
	beforeNavigate(({ to, cancel }) => {
		if (!isDirty()) return;
		if (!to?.url) return;
		cancel();
		pendingNavigationUrl = to.url;
		showLeaveConfirm = true;
	});

	/**
	 * 离开确认弹窗「确认」：自动保存后执行此前缓存的 SPA 导航
	 */
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

	/** 离开确认弹窗「取消」：清除待导航 URL */
	function handleLeaveCancel() {
		pendingNavigationUrl = null;
		showLeaveConfirm = false;
	}

	onDestroy(() => {
		upload.destroy();
		editor.destroy(); // 回收媒体与封面 object URL；顺序上先停 Uppy 再 revoke
	});
</script>

<main
	class="flex h-full flex-col rounded-2xl border-zinc-100 lg:mx-4 lg:h-[calc(100%-1rem)] lg:border"
>
	<div
		class="min-h-0 grow overflow-y-auto p-6"
		data-release-body-scroll
		use:scrollBoundary={{ axis: 'y' }}
	>
		<ReleaseCoverPreview
			ratio={editor.coverRatio}
			coverUrl={editor.coverPreviewUrl}
			source={editor.coverSource}
			isLoading={editor.isCoverResolving}
			onToggleRatio={editor.rotateCoverRatio}
		/>
		<ReleaseMediaPicker
			items={editor.cachedMediaItems}
			urls={editor.cachedMediaUrls}
			maxCount={editor.maxMediaCount}
			onFileSelect={editor.handleFileSelect}
			onRemove={editor.handleRemoveMedia}
			selectedCoverIndex={editor.selectedCoverIndex}
			onSelectCoverIndex={(i) => {
				editor.selectedCoverIndex = i;
			}}
			onReorder={editor.reorderMedia}
			mediaInteractionsDisabled={upload.isUploading}
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
			partitions={partitionsState.partitions}
			bind:selectedSection
			loading={partitionsState.loading}
			error={partitionsState.error}
		/>
	</div>
	<ReleaseActionBar
		isUploading={upload.isUploading}
		uploadProgress={upload.uploadProgress}
		hasUploadError={upload.hasUploadError}
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
		onRetryUpload={handleRetryUpload}
		onRemoveFailedAndProceed={handleRemoveFailedAndProceed}
	/>
</main>
