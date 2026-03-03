<script module lang="ts">
	// 常量定义
	// 参考产品需求文档 6.2.5 发布 (Release)
	import { linear } from 'svelte/easing';
	import { CoverRatioArray, type CoverRatio } from '$lib/storage/release-draft';

	// 封面比例对应的宽高
	const coverRatioToAspectRatio: Record<CoverRatio, string> = {
		'1:1': 'w-39 h-39',
		'4:3': 'w-52 h-39',
		'3:4': 'w-39 h-52'
	} as const;
	const defaultCoverRatio: CoverRatio = '3:4';

	const titleWordLimit = 20; // 标题字数限制，需求 6.2.5.1-3：最大 20 个字符

	// 出现然后淡出，用于封面比例标签提示
	const appearThenFade = (_: Element, { delay = 500, duration = 400, easing = linear } = {}) => {
		return {
			delay,
			duration,
			easing,
			css: (t: number) => `opacity: ${1 - t};`
		};
	};
</script>

<script lang="ts">
	/**
	 * 发布页 - 产品需求 6.2.5
	 * TODO(6.2.5.4-8): toast 提示：「已取消上传」「帖子发布成功」「帖子上传过程中发生错误，请重试」
	 * TODO(6.2.5.4-9): iOS/Android Webview 保活，保障应用在后台时也能处理、上传图片视频
	 */
	import { onMount } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { cn } from '$lib/utils';
	import { PlusIcon } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { ConfirmDialog } from '$lib/components/custom/confirm-dialog';
	import {
		ShinRichTextarea,
		extractContentFromShinRichTextarea
	} from '$lib/components/custom/shin-rich';
	import * as Select from '$lib/components/ui/select';
	import { partitionServiceListPartitions } from '$lib/api';
	import type { V1CreatePostRequest, V1PostContentUnit } from '$lib/api/types.gen';
	import {
		saveReleaseDraft,
		loadReleaseDraft,
		clearReleaseDraft,
		type ReleaseDraft
	} from '$lib/storage/release-draft';
	import { formatTimeAccuracyFirst } from '$lib/utils/format-time';
	import { resolve } from '$app/paths';

	const DRAFT_ID = 'release-draft';

	let lastSaved = $state<string | null>(null);
	let lastSavedIsAutoSave = $state(false);
	let lastSavedSnapshot = $state<ReleaseDraft | null>(null);

	let cachedImagesDataURLs = $state<string[]>([]);
	let selectedImageURL = $state<string | null>(null);
	let coverRatio = $state<CoverRatio>(defaultCoverRatio);
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

	let selectedSectionLabel = $derived(
		partitionsLoading
			? '加载中...'
			: selectedSection
				? (partitions.find((p) => p.value === selectedSection)?.label ?? '请选择')
				: '请选择'
	);

	function buildDraft(isAutoSave: boolean): ReleaseDraft {
		return {
			id: DRAFT_ID,
			updatedAt: new Date().toISOString(),
			isAutoSave,
			title: titleContent,
			bodyContent: contenteditableRef ? extractContentFromShinRichTextarea(contenteditableRef) : [],
			selectedSection,
			coverRatio,
			coverDataURL: selectedImageURL,
			mediaDataURLs: [...cachedImagesDataURLs]
		};
	}

	function draftsEqual(a: ReleaseDraft, b: ReleaseDraft): boolean {
		return (
			a.title === b.title &&
			a.selectedSection === b.selectedSection &&
			a.coverRatio === b.coverRatio &&
			a.coverDataURL === b.coverDataURL &&
			JSON.stringify(a.bodyContent) === JSON.stringify(b.bodyContent) &&
			JSON.stringify(a.mediaDataURLs) === JSON.stringify(b.mediaDataURLs)
		);
	}

	function isDirty(): boolean {
		if (!lastSavedSnapshot) return true;
		return !draftsEqual(buildDraft(false), lastSavedSnapshot);
	}

	async function performSave(isAutoSave: boolean) {
		const draft = buildDraft(isAutoSave);
		await saveReleaseDraft(draft);
		lastSaved = draft.updatedAt;
		lastSavedIsAutoSave = isAutoSave;
		lastSavedSnapshot = draft;
	}

	function handleSave() {
		if (!isDirty()) {
			// TODO(6.2.5.2-2): 使用 toast 提示「没有需要保存的变更」，替换 alert
			alert('没有需要保存的变更');
			return;
		}
		performSave(false);
	}

	function handleReset() {
		// TODO(6.2.5.2-1): 区分新建/编辑——编辑现有帖子时应重置为现网内容，而非清空
		titleContent = '';
		coverRatio = defaultCoverRatio;
		cachedImagesDataURLs = [];
		selectedImageURL = null;
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

	// TODO(6.2.5.4): 发布时需先处理、上传图片视频，获取 media_assets 后再调用 CreatePost
	function createPostRequest(): V1CreatePostRequest {
		return {
			batch_id: undefined,
			title: titleContent,
			content: extractContentFromShinRichTextarea(contenteditableRef as HTMLElement),
			partition_id: selectedSection || undefined,
			media_assets: undefined
		};
	}

	function handleSubmit() {
		// TODO(6.2.5.1): 表单校验——封面、图片/视频、正文填任意一种即可通过
		if (!selectedSection) {
			// TODO(6.2.5.2-3): 使用 toast 提示，替换 alert；发布前需二次确认弹窗
			alert('请选择分区');
			return;
		}
		const postRequest = createPostRequest();
		console.log(postRequest);
		// TODO(6.2.5.4): 确认发布后显示 App 横幅通知（封面、上传状态、进度），支持多任务叠加、隐藏/圆形状态栏、重试/删除
	}

	// 如果未选择封面，则使用第一张图片作为封面
	// 需求 6.2.5.1-1：未设置封面时，以第 1 张图片或视频首帧作为封面
	// TODO(6.2.5.1-1): 视频首帧兜底、无图片/视频时用正文内容生成封面
	$effect(() => {
		if (selectedImageURL === null && cachedImagesDataURLs.length > 0) {
			selectedImageURL = cachedImagesDataURLs[0];
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
		// 加载草稿
		loadReleaseDraft(DRAFT_ID).then((draft) => {
			if (!draft) return;
			titleContent = draft.title;
			selectedSection = draft.selectedSection;
			coverRatio = draft.coverRatio as CoverRatio;
			selectedImageURL = draft.coverDataURL;
			cachedImagesDataURLs = [...(draft.mediaDataURLs ?? [])];
			initialBodyContent = draft.bodyContent ?? [];
			lastSaved = draft.updatedAt;
			lastSavedIsAutoSave = draft.isAutoSave;
			lastSavedSnapshot = draft;
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
		<button
			class={cn(
				'relative mt-4 flex cursor-pointer items-center justify-center rounded-xl bg-muted transition-all',
				coverRatioToAspectRatio[coverRatio]
			)}
			onclick={rotateCoverRatio}
		>
			{#if selectedImageURL}
				<img
					src={selectedImageURL}
					alt="封面"
					class="h-full w-full cursor-pointer object-cover"
					draggable="false"
				/>
				<!-- TODO(6.2.5.1-1): 封面只能选 1 张图，选择后强制弹出图片视频预览编辑器裁切成 1:1/4:3/3:4 -->
			{:else}
				<span class="text-xs text-muted-foreground">比例1:1 / 4:3 / 3:4</span>
			{/if}
			<!-- 封面比例标签提示，当封面比例改变时，标签提示出现，经过小段时间后标签自动淡出 -->
			{#key coverRatio}
				<div
					class="pointer-events-none absolute top-5/6 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-zinc-900/60 px-2 py-1 text-xs text-zinc-100 opacity-0"
					in:appearThenFade
				>
					{coverRatio}
				</div>
			{/key}
		</button>
		<!-- 选择封面 -->
		<!-- TODO(6.2.5.1-2): 选择图片/视频，最多 20 张；选择后不弹出编辑器；支持删除 -->
		<Label class="mt-6 text-lg font-bold">选择图片/视频</Label>
		<div class="mt-4 flex gap-2">
			{#each cachedImagesDataURLs as imageDataURL, index (index)}
				<div class="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl bg-muted">
					<img src={imageDataURL} alt="封面" class="h-full w-full object-cover" />
				</div>
			{/each}
			<div
				class="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl bg-muted hover:bg-muted-foreground/10"
			>
				<PlusIcon class="size-4 text-muted-foreground" />
			</div>
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
			<!-- TODO(6.2.5.1-3): 传入 onMentionClick 使点击 @ 标识进入目标用户个人资料页 -->
			<ShinRichTextarea
				placeholder="添加帖子描述"
				class="mt-5"
				bind:contentEditableRef={contenteditableRef}
				initialContent={initialBodyContent}
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
				<Button variant="tertiary" class="cursor-pointer text-muted-foreground">重置</Button>
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
				<p>有未保存的变更，是否退出编辑？退出前将自动保存。</p>
			{/snippet}
		</ConfirmDialog>
		<Button variant="tertiary" class="cursor-pointer text-muted-foreground" onclick={handleSave}
			>保存</Button
		>
		<!-- TODO(6.2.5.2-3): 发布前弹出二次确认弹窗 -->
		<Button
			variant="default"
			class="flex-1 cursor-pointer transition-none lg:flex-none"
			onclick={handleSubmit}>发布帖子</Button
		>
		{#if lastSaved}
			<div class="mx-4 flex items-center text-sm text-muted-foreground">
				{lastSavedIsAutoSave ? '自动保存于 ' : '保存于 '}
				{formatTimeAccuracyFirst(lastSaved)}
			</div>
		{/if}
	</div>
</main>
