<script module lang="ts">
	import type { V1PostContentUnit as DraftContentUnit } from '$lib/api/types.gen';

	// 评论图片草稿（内存）：key = postId。关闭弹窗仍保留；该帖评论提交成功后会清空。
	const commentImageDraftCache = new Map<string, File[]>();
	// 富文本草稿（内存）：key = `${postId}::${editorKey}`，editorKey 为 root 或父评论 id，避免主评与回复串稿。
	const commentTextDraftCache = new Map<string, DraftContentUnit[]>();
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { V1Comment } from '$lib/api';
	import type { V1PostContentUnit } from '$lib/api/types.gen';
	import {
		ShinRichTextarea,
		createFetchMentionUsersFromFollowings,
		extractContentFromShinRichTextarea
	} from '$lib/components/custom/shin-rich';
	import { Image as ImageIcon, Plus } from 'lucide-svelte';
	import { messageForOperationError } from '$lib/utils/operation-error-message';
	import { toast } from 'svelte-sonner';

	/**
	 * EditCommentPopover — 评论/回复输入区（富文本 + 可选图片）
	 *
	 * **使用场景**：由 `PostDetail` 等父组件嵌入底部或回复流旁；同一帖子可多次打开，草稿按 `postId` 与编辑上下文区分。
	 *
	 * **能力**
	 * - 正文：`ShinRichTextarea`，支持 @ 提及（关注列表拉取）、纯文本长度上限 300（与 `maxLength` 一致）
	 * - 图片：最多 6 张、单张 ≤100MB；预览用 blob URL，提交时通过 `onSubmit` 传出 `File[]`
	 * - `replyTo` 有值时占位符为 `回复 @昵称`，编辑器正文不预填 @（与父/子评论一致），仍可用富文本 @ 提及
	 *
	 * **草稿策略**（见 `<script module>` 内 Map）：文本/图片在内存中缓存，刷新页面会丢失；提交成功由父组件配合清空图片缓存。
	 *
	 * **回调**：`onSubmit(content, replyTo, mediaFiles)` 由父组件调用真实/Mock API；`onCancel` 仅关闭，不自动清草稿（除非父组件另行处理）。
	 */
	let {
		postId = null as string | null,
		replyTo = null as V1Comment | null,
		placeholder = '写下评论…',
		onSubmit = async (_content: string, _replyTo: V1Comment | null, _mediaFiles: File[]) => {
			await Promise.resolve({ _content, _replyTo, _mediaFiles });
		},
		onCancel = () => {}
	}: {
		postId?: string | null;
		replyTo?: V1Comment | null;
		placeholder?: string;
		onSubmit?: (
			content: string,
			replyTo: V1Comment | null,
			mediaFiles: File[]
		) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	type CommentImageItem = {
		id: string;
		file: File;
		previewUrl: string;
	};

	const MAX_IMAGES = 6;
	const MAX_IMAGE_SIZE_BYTES = 100 * 1024 * 1024;
	const fetchMentionUsers = createFetchMentionUsersFromFollowings();

	let contentEditableRef = $state<HTMLDivElement | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let imageItems = $state<CommentImageItem[]>([]);
	let submitting = $state(false);
	let caretInitializedKey = $state<string | null>(null);
	let activeDraftPostKey = $state<string | null>(null);
	let activeDraftTextKey = $state<string | null>(null);

	const displayPlaceholder = $derived(
		!replyTo ? placeholder : `回复 @${replyTo.author?.name ?? '用户'}`
	);
	const editorKey = $derived(replyTo?.commentId ?? 'root');
	const normalizedPostId = $derived.by(() => {
		const v = postId?.trim();
		return v ? v : null;
	});
	const textDraftKey = $derived.by(() =>
		normalizedPostId ? `${normalizedPostId}::${editorKey}` : null
	);
	const initialEditorContent = $derived.by<V1PostContentUnit[]>(() => {
		if (textDraftKey) {
			const cached = commentTextDraftCache.get(textDraftKey);
			if (cached && cached.length > 0) {
				return cached.map((unit) => ({ ...unit }));
			}
		}
		return [];
	});

	function normalizeText(raw: string): string {
		return raw
			.replace(/\u200B/g, '')
			.replace(/\u00A0/g, ' ')
			.replace(/\r\n/g, '\n')
			.trim();
	}

	function getEditorContent(): string {
		if (!contentEditableRef) return '';
		return normalizeText(contentEditableRef.innerText ?? '');
	}

	function openImagePicker() {
		if (imageItems.length >= MAX_IMAGES) {
			toast.error('最多只能上传 6 张图片');
			return;
		}
		fileInputRef?.click();
	}

	function clearFileInput() {
		if (fileInputRef) {
			fileInputRef.value = '';
		}
	}

	function saveDraftFiles(postKey: string) {
		if (imageItems.length === 0) {
			commentImageDraftCache.delete(postKey);
			return;
		}
		commentImageDraftCache.set(
			postKey,
			imageItems.map((item) => item.file)
		);
	}

	function restoreDraftFiles(postKey: string) {
		const cachedFiles = commentImageDraftCache.get(postKey);
		if (!cachedFiles || cachedFiles.length === 0) return;
		imageItems = cachedFiles.slice(0, MAX_IMAGES).map((file) => ({
			id: crypto.randomUUID(),
			file,
			previewUrl: URL.createObjectURL(file)
		}));
	}

	function saveDraftText(draftKey: string) {
		const editor = contentEditableRef;
		if (!editor) return;
		const units = extractContentFromShinRichTextarea(editor);
		if (units.length === 0) {
			commentTextDraftCache.delete(draftKey);
			return;
		}
		commentTextDraftCache.set(
			draftKey,
			units.map((unit) => ({ ...unit }))
		);
	}

	function appendImageFiles(files: File[]) {
		const remain = MAX_IMAGES - imageItems.length;
		if (remain <= 0) {
			toast.error(`最多上传 ${MAX_IMAGES} 张图片`);
			return;
		}

		const imageFiles = files.filter((f) => f.type.startsWith('image/'));
		const validSizeFiles = imageFiles.filter((f) => f.size <= MAX_IMAGE_SIZE_BYTES);
		const finalAccepted = validSizeFiles.slice(0, remain);
		const rejectedCount = files.length - finalAccepted.length;

		imageItems = [
			...imageItems,
			...finalAccepted.map((file) => ({
				id: crypto.randomUUID(),
				file,
				previewUrl: URL.createObjectURL(file)
			}))
		];
		if (normalizedPostId) saveDraftFiles(normalizedPostId);

		if (rejectedCount > 0) {
			toast.error(`仅支持图片（单张不超过 100MB），且最多 ${MAX_IMAGES} 张`);
		}
	}

	function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const files = target.files ? Array.from(target.files) : [];
		if (files.length > 0) {
			appendImageFiles(files);
		}
		clearFileInput();
	}

	function removeImage(imageId: string) {
		const target = imageItems.find((item) => item.id === imageId);
		if (target) {
			URL.revokeObjectURL(target.previewUrl);
		}
		imageItems = imageItems.filter((item) => item.id !== imageId);
		if (normalizedPostId) saveDraftFiles(normalizedPostId);
	}

	function clearImages(options?: { clearDraft?: boolean }) {
		for (const item of imageItems) {
			URL.revokeObjectURL(item.previewUrl);
		}
		imageItems = [];
		const key = normalizedPostId;
		if (options?.clearDraft && key) {
			commentImageDraftCache.delete(key);
		}
	}

	async function handleSubmit() {
		const text = getEditorContent();
		if ((!text && imageItems.length === 0) || submitting) return;
		submitting = true;
		try {
			await onSubmit(
				text,
				replyTo,
				imageItems.map((item) => item.file)
			);
			if (contentEditableRef) {
				contentEditableRef.innerHTML = '';
			}
			clearImages({ clearDraft: true });
			if (textDraftKey) {
				commentTextDraftCache.delete(textDraftKey);
			}
			onCancel();
		} catch (error) {
			toast.error(messageForOperationError(error, '发送失败，请重试'));
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		return () => {
			if (activeDraftPostKey) {
				saveDraftFiles(activeDraftPostKey);
			}
			if (activeDraftTextKey) {
				saveDraftText(activeDraftTextKey);
			}
			clearImages();
		};
	});

	$effect(() => {
		const nextKey = normalizedPostId;
		if (activeDraftPostKey === nextKey) return;
		if (activeDraftPostKey) {
			saveDraftFiles(activeDraftPostKey);
		}
		clearImages();
		activeDraftPostKey = nextKey;
		if (nextKey) {
			restoreDraftFiles(nextKey);
		}
	});

	$effect(() => {
		const nextKey = textDraftKey;
		if (activeDraftTextKey === nextKey) return;
		if (activeDraftTextKey) {
			saveDraftText(activeDraftTextKey);
		}
		activeDraftTextKey = nextKey;
	});

	$effect(() => {
		const editor = contentEditableRef;
		if (!editor) return;
		const onInput = () => {
			if (!activeDraftTextKey) return;
			saveDraftText(activeDraftTextKey);
		};
		editor.addEventListener('input', onInput);
		return () => {
			editor.removeEventListener('input', onInput);
		};
	});

	$effect(() => {
		const key = editorKey;
		const editor = contentEditableRef;
		if (!editor) return;
		if (caretInitializedKey === key) return;

		requestAnimationFrame(() => {
			if (contentEditableRef !== editor) return;
			editor.focus();
			const selection = window.getSelection();
			if (!selection) return;
			const range = document.createRange();
			range.selectNodeContents(editor);
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
			caretInitializedKey = key;
		});
	});
</script>

{#if replyTo}
	<p class="mb-2 text-xs text-zinc-500">回复 @{replyTo.author?.name ?? '用户'}</p>
{/if}
{#key editorKey}
	<ShinRichTextarea
		bind:contentEditableRef
		placeholder={displayPlaceholder}
		maxLength={300}
		initialContent={initialEditorContent}
		{fetchMentionUsers}
		atButtonIconOnly={true}
		class="mb-2 min-h-[96px] border border-zinc-200 dark:border-zinc-700"
	/>
{/key}

<input
	bind:this={fileInputRef}
	type="file"
	class="hidden"
	accept="image/*"
	multiple
	onchange={handleFileChange}
/>

<div class="flex items-center justify-between gap-2">
	<div class="relative">
		<Button
			variant="block"
			size="icon"
			class="rounded-3xl px-3 py-1.5 text-accent-foreground"
			onclick={openImagePicker}
			disabled={submitting}
		>
			<ImageIcon class="size-4" />
		</Button>
	</div>
	<div class="flex justify-end gap-2">
		<Button size="sm" onclick={handleSubmit} disabled={submitting}>
			{submitting ? '发送中…' : '发送'}
		</Button>
		<Button variant="ghost" size="sm" onclick={onCancel} disabled={submitting}>取消</Button>
	</div>
</div>

{#if imageItems.length > 0}
	<div class="scrollbar-hide mb-2 flex gap-2 overflow-x-auto pb-1">
		{#each imageItems as item (item.id)}
			<div
				class="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
			>
				<img src={item.previewUrl} alt="评论图片预览" class="h-full w-full object-cover" />
				<button
					type="button"
					class="absolute top-0 right-0 h-5 w-5 cursor-pointer rounded-bl bg-black/60 text-xs text-white"
					aria-label="移除图片"
					onclick={() => removeImage(item.id)}
				>
					×
				</button>
			</div>
		{/each}
		{#if imageItems.length < MAX_IMAGES}
			<button
				type="button"
				class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-[#f4f4f5]"
				aria-label="添加图片"
				onclick={openImagePicker}
			>
				<div class="flex h-6 w-6 items-center justify-center rounded-full">
					<Plus class="size-4 text-[#d4d4d8]" />
				</div>
			</button>
		{/if}
	</div>
{/if}
