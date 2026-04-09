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
	import { messageForOperationError } from '$lib/utils/operation-error-message';
	import { toast } from 'svelte-sonner';
	import { PlusIcon } from 'lucide-svelte';

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
	const MENU_DEDUPE_MS = 320;

	let contentEditableRef = $state<HTMLDivElement | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let imageItems = $state<CommentImageItem[]>([]);
	let submitting = $state(false);
	let caretInitializedKey = $state<string | null>(null);
	let activeDraftPostKey = $state<string | null>(null);
	let activeDraftTextKey = $state<string | null>(null);

	let menuOpen = $state(false);
	let menuIndex = $state(0);
	let menuAnchorLeft = $state(0);
	let menuAnchorTop = $state(0);
	let menuPanelRef = $state<HTMLDivElement | null>(null);
	let menuAdjusted = $state({ left: 0, top: 0 });
	let lastMenuOpenAt = 0;
	let lastMenuOpenIndex = -1;

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

	function tryOpenMenu(index: number, clientX: number, clientY: number): void {
		if (submitting) return;
		const now = Date.now();
		if (index === lastMenuOpenIndex && now - lastMenuOpenAt < MENU_DEDUPE_MS) return;
		lastMenuOpenIndex = index;
		lastMenuOpenAt = now;
		menuIndex = index;
		menuAnchorLeft = clientX;
		menuAnchorTop = clientY;
		menuOpen = true;
	}

	function closeMenu(): void {
		menuOpen = false;
	}

	function onCardContextMenu(e: MouseEvent, index: number): void {
		e.preventDefault();
		if (submitting) return;
		const sc = (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } })
			.sourceCapabilities;
		// 触摸/仿真长按产生的 contextmenu：只拦系统菜单，不弹业务菜单（避免打断手势/滚动）
		if (sc?.firesTouchEvents === true) return;
		// 无 sourceCapabilities 的粗指针环境：保守处理，避免长按当右键菜单
		if (
			sc == null &&
			window.matchMedia('(pointer: coarse)').matches &&
			navigator.maxTouchPoints > 0
		) {
			return;
		}
		tryOpenMenu(index, e.clientX, e.clientY);
	}

	function removeFromMenu(): void {
		const target = imageItems[menuIndex];
		if (!target) {
			closeMenu();
			return;
		}
		removeImage(target.id);
		closeMenu();
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
		const text = getEditorContent().slice(0, 300);
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

	$effect(() => {
		if (!menuOpen || !menuPanelRef) return;
		void [menuOpen, menuAnchorLeft, menuAnchorTop, menuPanelRef];

		const pad = 8;
		const vv = window.visualViewport;
		const vw = vv?.width ?? window.innerWidth;
		const vh = vv?.height ?? window.innerHeight;
		const vx = vv?.offsetLeft ?? 0;
		const vy = vv?.offsetTop ?? 0;
		const rect = menuPanelRef.getBoundingClientRect();
		let left = menuAnchorLeft;
		let top = menuAnchorTop;
		if (left + rect.width > vx + vw - pad) {
			left = vx + vw - rect.width - pad;
		}
		if (left < vx + pad) {
			left = vx + pad;
		}
		if (top + rect.height > vy + vh - pad) {
			top = vy + vh - rect.height - pad;
		}
		if (top < vy + pad) {
			top = vy + pad;
		}
		menuAdjusted = { left, top };
	});

	$effect(() => {
		if (!menuOpen) return;

		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') closeMenu();
		};
		const onPointerDown = (e: PointerEvent): void => {
			if (menuPanelRef?.contains(e.target as Node)) return;
			requestAnimationFrame(() => {
				if (menuPanelRef && !menuPanelRef.contains(e.target as Node)) closeMenu();
			});
		};

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('pointerdown', onPointerDown, true);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('pointerdown', onPointerDown, true);
		};
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
		class="mb-2 min-h-11! border border-zinc-200 shadow-none dark:border-zinc-700"
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

{#if imageItems.length > 0}
	<div class="mt-2 flex flex-wrap gap-2">
		{#each imageItems as item, index (item.id)}
			<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
			<div
				class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-muted select-none dark:border-zinc-700"
				aria-label={`评论图片 ${index + 1}，右键打开操作菜单`}
				onclick={(e) => {
					tryOpenMenu(index, e.clientX, e.clientY);
				}}
				oncontextmenu={(e) => onCardContextMenu(e, index)}
			>
				<img
					src={item.previewUrl}
					alt={`评论图片预览 ${index + 1}`}
					class="h-full w-full object-cover select-none [-webkit-touch-callout:none]"
					draggable="false"
				/>
			</div>
		{/each}
		{#if imageItems.length < MAX_IMAGES}
			<button
				type="button"
				class="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-muted hover:bg-muted-foreground/10"
				onclick={openImagePicker}
				disabled={submitting}
				aria-label="添加图片"
			>
				<PlusIcon class="size-4 text-muted-foreground" />
			</button>
		{/if}
	</div>
	<p class="text-sm text-muted-foreground">最多 {MAX_IMAGES} 张图片，已选 {imageItems.length} 张</p>
{/if}

{#if imageItems.length === 0}
	<div class="mt-2 flex flex-wrap gap-2">
		<button
			type="button"
			class="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-muted hover:bg-muted-foreground/10"
			onclick={openImagePicker}
			disabled={submitting}
			aria-label="添加图片"
		>
			<PlusIcon class="size-4 text-muted-foreground" />
		</button>
	</div>
	<p class="text-sm text-muted-foreground">最多 {MAX_IMAGES} 张图片，已选 {imageItems.length} 张</p>
{/if}

<div class="flex items-center justify-between gap-2">
	<div></div>
	<div class="flex justify-end gap-2">
		<Button size="sm" onclick={handleSubmit} disabled={submitting}>
			{submitting ? '发送中…' : '发送'}
		</Button>
		<Button variant="ghost" size="sm" onclick={onCancel} disabled={submitting}>取消</Button>
	</div>
</div>

{#if menuOpen}
	<div
		bind:this={menuPanelRef}
		class="fixed z-50 min-w-40 rounded-md border border-zinc-200 bg-popover p-1 text-popover-foreground shadow-md dark:border-zinc-700"
		style:left="{menuAdjusted.left}px"
		style:top="{menuAdjusted.top}px"
		role="menu"
		aria-label="评论图片操作"
	>
		<button
			type="button"
			class="flex min-h-11 w-full cursor-pointer items-center rounded-sm px-3 py-2 text-left text-sm text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-800"
			role="menuitem"
			onclick={removeFromMenu}
		>
			删除
		</button>
	</div>
{/if}
