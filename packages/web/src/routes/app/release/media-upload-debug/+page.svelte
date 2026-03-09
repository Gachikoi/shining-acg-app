<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { UppyFile } from '@uppy/core';

	import { mediaServiceAbortMultipartUpload } from '$lib/api';
	import { buildPrepareUploadParams, createMediaUploader } from '$lib/modules/media-uploader';
	import type {
		BatchProgressEvent,
		MediaUploader,
		MediaUploadMeta,
		PrepareUploadParams,
		PrepareUploadSelection
	} from '$lib/modules/media-uploader';
	import type { V1MediaAsset, V1MediaScene } from '$lib/api';

	type UppyMultipartFile = UppyFile<MediaUploadMeta, Record<string, never>> & {
		s3Multipart?: {
			uploadId?: string;
			key?: string;
		};
	};

	type DraftSelection = {
		localId: string;
		scene: V1MediaScene;
		cropCover: boolean;
		files: File[];
	};

	type FileProgress = {
		fileName: string;
		bytesUploaded: number;
		bytesTotal: number;
		percent: number;
	};

	type TaskRow = {
		uppyFileId: string;
		fileName: string;
		taskId?: string;
		uploadId?: string;
		objectKey?: string;
	};

	const sceneOptions: Array<{ label: string; value: V1MediaScene }> = [
		{ label: '帖子媒体', value: 'MEDIA_SCENE_POST_MEDIA' },
		{ label: '评论媒体', value: 'MEDIA_SCENE_COMMENT_MEDIA' },
		{ label: '帖子封面', value: 'MEDIA_SCENE_POST_COVER' },
		{ label: '头像', value: 'MEDIA_SCENE_USER_AVATAR' }
	];

	let unsubscribeBatchProgress: (() => void) | null = null;

	let token = $state('');
	let batchId = $state('');
	let draftSelections = $state<DraftSelection[]>([]);
	let preparedParamsDraft = $state<PrepareUploadParams>([]);
	let draftError = $state<string | null>(null);
	let isPreparing = $state(false);
	let isUploading = $state(false);
	let preparedTaskCount = $state(0);
	let logs = $state<string[]>([]);
	let batchProgress = $state<BatchProgressEvent | null>(null);
	let batchProgressHistory = $state<BatchProgressEvent[]>([]);
	let mediaAssets = $state<V1MediaAsset[]>([]);
	let fileProgressById = $state<Record<string, FileProgress>>({});
	let taskRows = $state<TaskRow[]>([]);
	let isAbortingByTaskId = $state<Record<string, boolean>>({});
	let mediaUploader = $state<MediaUploader | null>(null);

	function appendLog(message: string) {
		const now = new Date().toLocaleTimeString();
		logs = [`[${now}] ${message}`, ...logs].slice(0, 200);
	}

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

	function formatUploadError(error: unknown): string {
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

	function isWKWebViewEnv(): boolean {
		if (typeof window === 'undefined') {
			return false;
		}
		return !!window.webkit?.messageHandlers?.ShiningBridge;
	}

	function createSelection(): DraftSelection {
		return {
			localId: crypto.randomUUID(),
			scene: 'MEDIA_SCENE_POST_MEDIA',
			cropCover: false,
			files: []
		};
	}

	function addSelection() {
		draftSelections = [...draftSelections, createSelection()];
		refreshPreparedParamsDraft();
	}

	function removeSelection(localId: string) {
		draftSelections = draftSelections.filter((item) => item.localId !== localId);
		refreshPreparedParamsDraft();
	}

	function updateSelection(localId: string, mapper: (item: DraftSelection) => DraftSelection) {
		draftSelections = draftSelections.map((item) =>
			item.localId === localId ? mapper(item) : item
		);
		refreshPreparedParamsDraft();
	}

	function buildSelectionInputs(): PrepareUploadSelection[] {
		return draftSelections
			.filter((selection) => selection.files.length > 0)
			.map((selection) => ({
				scene: selection.scene,
				files: selection.files,
				cropCover: selection.cropCover
			}));
	}

	function refreshPreparedParamsDraft() {
		try {
			preparedParamsDraft = buildPrepareUploadParams(buildSelectionInputs());
			draftError = null;
			appendLog(`已更新本地草稿参数：items=${preparedParamsDraft.length}`);
		} catch (error) {
			preparedParamsDraft = [];
			draftError = error instanceof Error ? error.message : String(error);
			appendLog(`草稿参数构建失败：${draftError}`);
		}
	}

	function saveToken() {
		if (typeof window === 'undefined') {
			return;
		}
		const value = token.trim();
		if (!value) {
			window.localStorage.removeItem('token');
			appendLog('已清空 token');
			return;
		}
		window.localStorage.setItem('token', value);
		appendLog('已保存 token 到 localStorage');
	}

	function refreshTaskRows() {
		if (!mediaUploader) {
			taskRows = [];
			preparedTaskCount = 0;
			return;
		}
		taskRows = (mediaUploader.uppy.getFiles() as UppyMultipartFile[]).map((file) => ({
			uppyFileId: file.id,
			fileName: file.name ?? file.id,
			taskId: file.meta.task_id,
			uploadId: file.s3Multipart?.uploadId,
			objectKey: file.s3Multipart?.key
		}));
		preparedTaskCount = taskRows.length;
	}

	function attachUppyListeners(instance: MediaUploader) {
		instance.uppy.on('upload-progress', (file, progress) => {
			if (!file?.id) {
				return;
			}
			fileProgressById = {
				...fileProgressById,
				[file.id]: {
					fileName: file.name ?? file.id,
					bytesUploaded: progress.bytesUploaded,
					bytesTotal: progress.bytesTotal,
					percent: progress.bytesTotal
						? Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
						: 0
				}
			};
			refreshTaskRows();
		});

		instance.uppy.on('file-added', refreshTaskRows);
		instance.uppy.on('file-removed', refreshTaskRows);
		instance.uppy.on('error', (error) => {
			appendLog(`Uppy error: ${formatUploadError(error)}`);
		});
		instance.uppy.on('upload-error', (file, error) => {
			appendLog(
				`Uppy upload-error file=${file?.name ?? file?.id ?? 'unknown'}: ${formatUploadError(error)}`
			);
		});
	}

	function rebuildUploader(logPrefix: string) {
		unsubscribeBatchProgress?.();
		unsubscribeBatchProgress = null;
		mediaUploader?.destroy();
		mediaUploader = createMediaUploader();
		attachUppyListeners(mediaUploader);
		refreshTaskRows();
		appendLog(`${logPrefix}`);
	}

	async function fetchBatchMedia(reason: string) {
		if (!mediaUploader || !batchId.trim()) {
			return;
		}

		try {
			const assets = await mediaUploader.getBatchMedia(batchId.trim());
			mediaAssets = assets;
			appendLog(`${reason}：GetBatchMedia 返回 ${assets.length} 项 media_assets`);
		} catch (error) {
			appendLog(
				`${reason}：GetBatchMedia 失败：${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	function clearStateForNewBatch() {
		preparedTaskCount = 0;
		batchProgress = null;
		batchProgressHistory = [];
		mediaAssets = [];
		fileProgressById = {};
		isAbortingByTaskId = {};
		taskRows = [];
		unsubscribeBatchProgress?.();
		unsubscribeBatchProgress = null;
	}

	async function prepareAndStartUploadAction() {
		if (!mediaUploader) {
			appendLog('mediaUploader 尚未初始化');
			return;
		}
		if (preparedParamsDraft.length === 0) {
			appendLog('没有可用的本地 prepare 参数，请先选择文件');
			return;
		}
		if (draftError) {
			appendLog(`本地草稿参数有误：${draftError}`);
			return;
		}
		clearStateForNewBatch();
		isPreparing = true;
		appendLog('开始 PrepareUploadBatch');

		let currentBatchId = '';

		try {
			currentBatchId = await mediaUploader.upload(preparedParamsDraft);
			batchId = currentBatchId;
			refreshTaskRows();
			appendLog(`Prepare 完成：batch_id=${currentBatchId}，tasks=${preparedTaskCount}`);

			unsubscribeBatchProgress?.();
			unsubscribeBatchProgress = mediaUploader.subscribeBatchProgress(currentBatchId, (event) => {
				batchProgress = event;
				batchProgressHistory = [event, ...batchProgressHistory].slice(0, 120);
				appendLog(
					`WS stage=${event.stage ?? 'UNKNOWN'} percent=${event.transcode_percent ?? 0} message=${event.message ?? ''}`
				);
				if (event.stage === 'PROGRESS_STAGE_COMPLETED') {
					void fetchBatchMedia('WS 终态触发');
				}
				if (event.stage === 'PROGRESS_STAGE_FAILED') {
					appendLog('WS 通知批次失败，可点击 3) GetBatchMedia 手动刷新查看失败项');
				}
			});
		} catch (error) {
			appendLog(`Prepare 失败：${error instanceof Error ? error.message : String(error)}`);
			return;
		} finally {
			isPreparing = false;
		}

		isUploading = true;
		appendLog('开始上传分片到对象存储');
		try {
			const result = await mediaUploader.uppy.upload();
			const successCount = result?.successful?.length ?? 0;
			const failedCount = result?.failed?.length ?? 0;
			appendLog(`上传结束：成功 ${successCount}，失败 ${failedCount}`);
			if (failedCount === 0) {
				appendLog('上传完成，等待 WS 后处理进度或手动点击 3) GetBatchMedia');
			}
		} catch (error) {
			appendLog(`上传失败：${error instanceof Error ? error.message : String(error)}`);
		} finally {
			isUploading = false;
			refreshTaskRows();
		}
	}

	async function abortByTask(
		taskId?: string,
		uploadId?: string,
		objectKey?: string,
		fileName?: string
	) {
		if (!taskId || !uploadId || !objectKey) {
			appendLog(`Abort 跳过：缺少 task_id/upload_id/object_key（file=${fileName ?? 'unknown'}）`);
			return;
		}
		isAbortingByTaskId = { ...isAbortingByTaskId, [taskId]: true };

		try {
			await mediaServiceAbortMultipartUpload<true>({
				body: {
					taskId: taskId,
					uploadId: uploadId,
					objectKey: objectKey
				}
			});
			appendLog(`Abort 成功：task_id=${taskId}`);

			const uppyFile = mediaUploader?.uppy
				.getFiles()
				.find((file) => (file.meta as MediaUploadMeta | undefined)?.task_id === taskId);
			if (uppyFile) {
				mediaUploader?.uppy.removeFile(uppyFile.id);
				appendLog(`已从 Uppy 队列移除 task_id=${taskId}`);
			}
			refreshTaskRows();
			await fetchBatchMedia('Abort 后刷新');
		} catch (error) {
			appendLog(`Abort 失败：${error instanceof Error ? error.message : String(error)}`);
		} finally {
			const next = { ...isAbortingByTaskId };
			delete next[taskId];
			isAbortingByTaskId = next;
		}
	}

	function resetAll() {
		batchId = '';
		draftSelections = [];
		preparedParamsDraft = [];
		draftError = null;
		clearStateForNewBatch();
		logs = [];
		appendLog('已重置调试状态');
	}

	function detectPreviewKind(url?: string, type?: string): 'image' | 'video' | null {
		if (!url) {
			return null;
		}
		if (type === 'MEDIA_TYPE_VIDEO') {
			return 'video';
		}
		if (type === 'MEDIA_TYPE_IMAGE') {
			return 'image';
		}
		const normalized = url.toLowerCase();
		if (
			normalized.includes('.mp4') ||
			normalized.includes('.webm') ||
			normalized.includes('.mov') ||
			normalized.includes('.m4v') ||
			normalized.includes('.m3u8')
		) {
			return 'video';
		}
		return 'image';
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			token = window.localStorage.getItem('token') ?? '';
			appendLog(`env origin=${window.location.origin}`);
			appendLog(`env wkwebview=${isWKWebViewEnv() ? 'yes' : 'no'}`);
			appendLog(`env ua=${window.navigator.userAgent}`);
			if (isWKWebViewEnv()) {
				appendLog(
					'WKWebView 环境：若 upload-error 出现 source.status=0，多半是对象存储 CORS 或域名策略问题'
				);
			}
		}
		rebuildUploader('已创建 mediaUploader 实例');
		draftSelections = [createSelection()];
		refreshPreparedParamsDraft();
	});

	onDestroy(() => {
		unsubscribeBatchProgress?.();
		mediaUploader?.destroy();
	});
</script>

<main class="mx-auto flex h-screen w-full max-w-6xl flex-col gap-4 overflow-y-auto p-4">
	<section class="rounded-xl border border-zinc-200 bg-white p-4">
		<h1 class="text-xl font-semibold">Media Upload 调试页（延迟触发 Prepare）</h1>
		<p class="mt-2 text-sm text-zinc-600">
			选择文件时仅构建本地参数草稿，不发网络请求。点击 <code>2) Prepare + Start Upload</code> 后才会发起网络请求。
		</p>
	</section>

	<section class="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-2">
		<div class="flex flex-col gap-2">
			<label for="token" class="text-sm font-medium">Bearer Token（WS 必填）</label>
			<input
				id="token"
				class="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
				bind:value={token}
				placeholder="粘贴 access token；用于 HTTP Authorization + WS query token"
			/>
			<div class="flex gap-2">
				<button
					class="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white"
					onclick={saveToken}>保存 Token</button
				>
				<button
					class="w-fit rounded-lg bg-zinc-700 px-3 py-2 text-sm text-white"
					onclick={() => rebuildUploader('已重建 mediaUploader 实例')}
				>
					重建 Uploader
				</button>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<label for="batch-id" class="text-sm font-medium">batch_id（可留空自动生成）</label>
			<input
				id="batch-id"
				class="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
				bind:value={batchId}
			/>
		</div>

		<div class="flex items-end gap-2">
			<button class="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white" onclick={addSelection}
				>+ 文件选择组</button
			>
		</div>

		<div class="md:col-span-2">
			<div class="mb-2 text-sm font-medium">文件选择组（每组可一次选择多个文件）</div>
			<div class="space-y-3">
				{#each draftSelections as item (item.localId)}
					<div class="rounded-lg border border-zinc-200 p-3">
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<select
								class="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
								value={item.scene}
								onchange={(e) =>
									updateSelection(item.localId, (old) => ({
										...old,
										scene: (e.currentTarget as HTMLSelectElement).value as V1MediaScene,
										cropCover:
											(e.currentTarget as HTMLSelectElement).value === 'MEDIA_SCENE_POST_COVER'
												? old.cropCover
												: false
									}))}
							>
								{#each sceneOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
							<label class="flex items-center gap-2 text-sm text-zinc-700">
								<input
									type="checkbox"
									checked={item.cropCover}
									disabled={item.scene !== 'MEDIA_SCENE_POST_COVER'}
									onchange={(e) =>
										updateSelection(item.localId, (old) => ({
											...old,
											cropCover: (e.currentTarget as HTMLInputElement).checked
										}))}
								/>
								crop_cover（仅 POST_COVER 生效）
							</label>
							<button
								class="ml-auto rounded-lg bg-rose-600 px-3 py-2 text-xs text-white"
								onclick={() => removeSelection(item.localId)}
							>
								删除组
							</button>
						</div>

						<input
							type="file"
							multiple
							accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime,video/x-m4v,video/webm"
							onchange={(e) => {
								const files = Array.from((e.currentTarget as HTMLInputElement).files ?? []);
								updateSelection(item.localId, (old) => ({ ...old, files }));
							}}
						/>
						<div class="mt-2 text-xs text-zinc-600">
							已选 {item.files.length} 个文件
							{#if item.files.length > 0}
								：{item.files.map((file) => file.name).join(', ')}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="rounded-lg border border-zinc-200 p-3 md:col-span-2">
			<div class="text-sm font-medium">本地 prepare 参数草稿（无网络）</div>
			{#if draftError}
				<div class="mt-2 text-sm text-rose-700">{draftError}</div>
			{:else}
				<div class="mt-2 text-xs text-zinc-600">items: {preparedParamsDraft.length}</div>
			{/if}
		</div>

		<div class="flex flex-wrap gap-2 md:col-span-2">
			<button
				class="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
				onclick={prepareAndStartUploadAction}
				disabled={isPreparing || isUploading || preparedParamsDraft.length === 0 || !!draftError}
			>
				{isPreparing ? '准备中...' : isUploading ? '上传中...' : '2) Prepare + Start Upload'}
			</button>
			<button
				class="rounded-lg bg-cyan-700 px-4 py-2 text-sm text-white disabled:opacity-50"
				onclick={() => fetchBatchMedia('手动刷新')}
				disabled={isPreparing || isUploading || !batchId.trim()}
			>
				3) GetBatchMedia
			</button>
			<button
				class="rounded-lg bg-zinc-700 px-4 py-2 text-sm text-white disabled:opacity-50"
				onclick={resetAll}
				disabled={isPreparing || isUploading}
			>
				Reset
			</button>
		</div>
		<div class="text-xs text-zinc-500 md:col-span-2">
			Prepared 任务数：{preparedTaskCount}；结果获取策略：WS 终态触发单次 GetBatchMedia + 手动刷新
		</div>
	</section>

	<section class="grid gap-4 md:grid-cols-2">
		<div class="rounded-xl border border-zinc-200 bg-white p-4">
			<h2 class="text-base font-semibold">上传进度（Uppy）</h2>
			<div class="mt-3 flex flex-col gap-2">
				{#if Object.keys(fileProgressById).length === 0}
					<div class="text-sm text-zinc-500">暂无上传进度</div>
				{:else}
					{#each Object.entries(fileProgressById) as [fileId, p] (fileId)}
						<div class="rounded-lg border border-zinc-200 p-2 text-sm">
							<div class="truncate font-medium">{p.fileName}</div>
							<div class="text-zinc-600">file_id: {fileId}</div>
							<div class="text-zinc-600">
								{p.bytesUploaded} / {p.bytesTotal} bytes ({p.percent}%)
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<div class="rounded-xl border border-zinc-200 bg-white p-4">
			<h2 class="text-base font-semibold">后处理进度（WS / BatchProgress）</h2>
			{#if batchProgress}
				<div class="mt-3 space-y-1 text-sm">
					<div>stage: {batchProgress.stage}</div>
					<div>percent: {batchProgress.transcode_percent ?? 0}</div>
					<div>message: {batchProgress.message}</div>
				</div>
			{:else}
				<div class="mt-3 text-sm text-zinc-500">暂无 WS 进度</div>
			{/if}
		</div>
	</section>

	<section class="rounded-xl border border-zinc-200 bg-white p-4">
		<h2 class="text-base font-semibold">任务映射与 Abort</h2>
		<div class="mt-3 space-y-2">
			{#if taskRows.length === 0}
				<div class="text-sm text-zinc-500">暂无任务</div>
			{:else}
				{#each taskRows as row (row.uppyFileId)}
					<div class="rounded-lg border border-zinc-200 p-2 text-sm">
						<div class="font-medium">{row.fileName}</div>
						<div class="text-zinc-600">task_id: {row.taskId}</div>
						<div class="text-zinc-600">upload_id: {row.uploadId}</div>
						<div class="text-zinc-600">object_key: {row.objectKey}</div>
						<button
							class="mt-2 rounded-lg bg-rose-600 px-3 py-2 text-xs text-white disabled:opacity-50"
							onclick={() => abortByTask(row.taskId, row.uploadId, row.objectKey, row.fileName)}
							disabled={!row.taskId ||
								!row.uploadId ||
								!row.objectKey ||
								(row.taskId ? !!isAbortingByTaskId[row.taskId] : false)}
						>
							{row.taskId && isAbortingByTaskId[row.taskId] ? 'Abort 中...' : 'Abort 此文件'}
						</button>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<section class="rounded-xl border border-zinc-200 bg-white p-4">
		<h2 class="text-base font-semibold">GetBatchMedia 结果</h2>
		<div class="mt-3 space-y-3 text-sm">
			{#if mediaAssets.length === 0}
				<div class="text-zinc-500">暂无数据</div>
			{:else}
				{#each mediaAssets as asset, index (`${asset.assetId ?? 'asset'}-${index}`)}
					<div class="rounded-lg border border-zinc-200 p-3">
						<div>asset_id: {asset.assetId ?? '-'}</div>
						<div>order_index: {asset.orderIndex ?? '-'}</div>
						<div>status: {asset.status ?? '-'}</div>
						{#if asset.single}
							<div class="mt-2">
								<div class="font-medium">single</div>
								<div>file_id: {asset.single.fileId ?? '-'}</div>
								<div>
									url:
									{#if asset.single.url}
										<a
											href={asset.single.url}
											target="_blank"
											rel="noreferrer"
											class="break-all text-blue-700 underline"
										>
											{asset.single.url}
										</a>
									{:else}
										<span>-</span>
									{/if}
								</div>
								<div>status: {asset.single.status ?? '-'}</div>
								{#if asset.single.url}
									{#if detectPreviewKind(asset.single.url, asset.single.type ?? asset.type) === 'image'}
										<img
											class="mt-2 max-h-80 w-auto rounded border border-zinc-200"
											src={asset.single.url}
											alt={`asset-${asset.assetId ?? index}`}
											loading="lazy"
										/>
									{:else if detectPreviewKind(asset.single.url, asset.single.type ?? asset.type) === 'video'}
										<!-- svelte-ignore a11y_media_has_caption -->
										<video
											class="mt-2 max-h-80 w-full rounded border border-zinc-200"
											src={asset.single.url}
											controls
											preload="metadata"
										></video>
									{/if}
								{/if}
							</div>
						{/if}
						{#if asset.livePhoto}
							<div class="mt-2">
								<div class="font-medium">live_photo.image</div>
								<div>file_id: {asset.livePhoto.image?.fileId ?? '-'}</div>
								<div>
									url:
									{#if asset.livePhoto.image?.url}
										<a
											href={asset.livePhoto.image?.url}
											target="_blank"
											rel="noreferrer"
											class="break-all text-blue-700 underline"
										>
											{asset.livePhoto.image?.url}
										</a>
									{:else}
										<span>-</span>
									{/if}
								</div>
								<div>status: {asset.livePhoto.image?.status ?? '-'}</div>
								{#if asset.livePhoto.image?.url}
									<img
										class="mt-2 max-h-80 w-auto rounded border border-zinc-200"
										src={asset.livePhoto.image?.url}
										alt={`live-photo-image-${asset.assetId ?? index}`}
										loading="lazy"
									/>
								{/if}
								<div class="mt-2 font-medium">live_photo.video</div>
								<div>file_id: {asset.livePhoto.video?.fileId ?? '-'}</div>
								<div>
									url:
									{#if asset.livePhoto.video?.url}
										<a
											href={asset.livePhoto.video?.url}
											target="_blank"
											rel="noreferrer"
											class="break-all text-blue-700 underline"
										>
											{asset.livePhoto.video?.url}
										</a>
									{:else}
										<span>-</span>
									{/if}
								</div>
								<div>status: {asset.livePhoto.video?.status ?? '-'}</div>
								{#if asset.livePhoto.video?.url}
									<!-- svelte-ignore a11y_media_has_caption -->
									<video
										class="mt-2 max-h-80 w-full rounded border border-zinc-200"
										src={asset.livePhoto.video?.url}
										controls
										preload="metadata"
									></video>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<section class="rounded-xl border border-zinc-200 bg-white p-4">
		<h2 class="text-base font-semibold">日志</h2>
		<div
			class="mt-3 max-h-80 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
		>
			{#if logs.length === 0}
				<div class="text-zinc-400">暂无日志</div>
			{:else}
				{#each logs as log, idx (`${idx}-${log}`)}
					<div class="break-all">{log}</div>
				{/each}
			{/if}
		</div>
	</section>
</main>
