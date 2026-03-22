<script lang="ts">
	/**
	 * @component ReleaseMediaPicker
	 * @description
	 * 发布页「选择图片/视频」（需求 6.2.5.1-2）：缩略图网格、`+` 选文件、封面红环标识。
	 * - **触摸 / 鼠标**：**轻点**（未拖动即松手）打开菜单。触摸长按会触发合成 `contextmenu`：仅 `preventDefault` 抑制系统菜单，**不**打开业务菜单，以免打断拖拽用 Pointer；**桌面鼠标右键**仍打开菜单。
	 * - **排序**：列表根使用 `use:sortableList`（SortableJS）；整卡可拖，触摸下 `delay`+`delayOnTouchOnly` 与轻点菜单区分。左下 grip 仅为视觉提示（`pointer-events-none`）。
	 * - **键盘**：当前排序依赖指针拖拽；纯键盘用户可依赖后续「上移/下移」等增强（本组件未提供）。
	 * - **上传中**：`mediaInteractionsDisabled` 关闭菜单、右键与拖拽。
	 */
	import { PlusIcon } from 'lucide-svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Label } from '$lib/components/ui/label';
	import { sortableList } from '$lib/modules/sortable-list';
	import type { DraftMediaItem } from '$lib/stores/release';
	import { cn } from '$lib/utils.js';
	import { longPress } from '$lib/modules/gesture';

	/** 连点/右键与单击合并为单次打开（ms） */
	const MENU_DEDUPE_MS = 320;
	/** 拖动延迟（ms） */
	const DELAY = 400;

	let {
		items,
		urls,
		maxCount,
		onFileSelect,
		onRemove,
		selectedCoverIndex,
		onSelectCoverIndex,
		onReorder,
		mediaInteractionsDisabled
	}: {
		/** 草稿媒体项，与 `urls` 一一对应 */
		items: DraftMediaItem[];
		/** 预览 URL（object URL 或占位），与 `items` 等长 */
		urls: string[];
		/** 可选张数上限（如 20） */
		maxCount: number;
		onFileSelect: (event: Event) => void;
		/** 从菜单「删除」或未来其它入口移除一项 */
		onRemove: (index: number) => void;
		/** 当前作为封面的项下标，用于红环与 `设为封面` 状态 */
		selectedCoverIndex: number;
		onSelectCoverIndex: (index: number) => void;
		/** 由 Sortable `onEnd` 提交，应对应 `reorderMedia` */
		onReorder: (fromIndex: number, toIndex: number) => void;
		/** 为 true 时禁用缩略图一切手势（如 `upload.isUploading`） */
		mediaInteractionsDisabled: boolean;
	} = $props();

	let mediaFileInputRef: HTMLInputElement | null = null;
	let menuOpen = $state(false);
	let menuIndex = $state(0);
	let menuAnchorLeft = $state(0);
	let menuAnchorTop = $state(0);
	let menuPanelRef = $state<HTMLDivElement | null>(null);
	let menuAdjusted = $state({ left: 0, top: 0 });
	/** 与 `{#each … (urls[index])}` 一致，用预览 URL 标记被拖项 */
	let draggingUrl = $state<string | null>(null);

	let lastMenuOpenAt = 0;
	let lastMenuOpenIndex = -1;

	/** 成功重排后 Sortable 仍可能触发 `click`，用宏任务窗口抑制误开菜单 */
	let suppressNextCardClick = false;

	function handleSortableReorder(fromIndex: number, toIndex: number): void {
		suppressNextCardClick = true;
		setTimeout(() => {
			suppressNextCardClick = false;
		}, 0);
		onReorder(fromIndex, toIndex);
	}

	const captureMediaFileInput: Attachment<HTMLInputElement> = (element) => {
		mediaFileInputRef = element;
		return () => {
			if (mediaFileInputRef === element) {
				mediaFileInputRef = null;
			}
		};
	};

	function handleAddMediaClick(): void {
		mediaFileInputRef?.click();
	}

	function tryOpenMenu(index: number, clientX: number, clientY: number): void {
		if (mediaInteractionsDisabled) return;
		const now = Date.now();
		if (index === lastMenuOpenIndex && now - lastMenuOpenAt < MENU_DEDUPE_MS) {
			return;
		}
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
		if (mediaInteractionsDisabled) return;
		e.preventDefault();
		const sc = (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } })
			.sourceCapabilities;
		// 触摸/仿真长按产生的 contextmenu 会打断拖拽并触发 pointercancel；只拦原生菜单，不弹业务菜单
		if (sc?.firesTouchEvents === true) {
			return;
		}
		// 无 sourceCapabilities 的粗指针环境（如部分 WebKit）：保守处理，避免长按当右键菜单
		if (
			sc == null &&
			window.matchMedia('(pointer: coarse)').matches &&
			navigator.maxTouchPoints > 0
		) {
			return;
		}
		tryOpenMenu(index, e.clientX, e.clientY);
	}

	function setAsCover(): void {
		onSelectCoverIndex(menuIndex);
		closeMenu();
	}

	function removeFromMenu(): void {
		onRemove(menuIndex);
		closeMenu();
	}

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
			if (e.key === 'Escape') {
				closeMenu();
			}
		};

		const onPointerDown = (e: PointerEvent): void => {
			if (menuPanelRef?.contains(e.target as Node)) {
				return;
			}
			requestAnimationFrame(() => {
				if (menuPanelRef && !menuPanelRef.contains(e.target as Node)) {
					closeMenu();
				}
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

<Label class="mt-6 text-lg font-bold">选择图片/视频</Label>
<p class="text-sm text-muted-foreground">最多 {maxCount} 张，已选 {items.length} 张</p>

<input
	{@attach captureMediaFileInput}
	type="file"
	accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime,video/x-m4v,video/webm"
	multiple
	class="hidden"
	onchange={onFileSelect}
/>

<div
	class="mt-3 flex flex-wrap gap-2"
	aria-busy={mediaInteractionsDisabled}
	use:sortableList={{
		itemSelector: '[data-release-media-item]',
		itemCount: items.length,
		orderKey: urls.join('\0'),
		disabled: () => mediaInteractionsDisabled,
		onReorder: handleSortableReorder,
		onDragStart: (item) => {
			draggingUrl = item.getAttribute('data-preview-url');
		},
		onDragEnd: () => {
			draggingUrl = null;
		},
		delay: DELAY
	}}
>
	{#each items as _, index (urls[index])}
		<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
		<div
			class={cn(
				'relative h-24 w-24 shrink-0 cursor-grab overflow-hidden rounded-xl bg-muted select-none active:cursor-grabbing',
				selectedCoverIndex === index &&
					'ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-100 dark:ring-offset-zinc-900',
				draggingUrl !== null && urls[index] === draggingUrl && 'opacity-60'
			)}
			data-release-media-item
			data-preview-url={urls[index]}
			aria-label={`媒体 ${index + 1}，轻点打开操作菜单，拖动调整顺序`}
			onclick={(e) => {
				if (mediaInteractionsDisabled || suppressNextCardClick) return;
				tryOpenMenu(index, e.clientX, e.clientY);
			}}
			oncontextmenu={(e) => onCardContextMenu(e, index)}
			use:longPress={{
				delay: DELAY,
				onPress: (detail) => {
					draggingUrl = detail.currentTarget.getAttribute('data-preview-url');
				},
				onPressUp: () => {
					draggingUrl = null;
				}
			}}
		>
			<img
				src={urls[index]}
				alt={`媒体 ${index + 1}`}
				class="h-full w-full object-cover select-none [-webkit-touch-callout:none]"
				draggable="false"
			/>
			<!-- <div
				class="release-media-sort-hint pointer-events-none absolute bottom-0 left-0 flex items-end justify-start rounded-tr-md bg-zinc-900/50 p-2 text-zinc-100 dark:bg-zinc-950/60"
				aria-hidden="true"
			>
				<GripVerticalIcon class="size-4 shrink-0" aria-hidden="true" />
			</div> -->
		</div>
	{/each}
	{#if items.length < maxCount}
		<button
			type="button"
			class="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-muted hover:bg-muted-foreground/10"
			onclick={handleAddMediaClick}
			aria-label="添加图片/视频"
		>
			<PlusIcon class="size-4 text-muted-foreground" />
		</button>
	{/if}
</div>

{#if menuOpen}
	<div
		bind:this={menuPanelRef}
		class="fixed z-50 min-w-40 rounded-md border border-zinc-200 bg-popover p-1 text-popover-foreground shadow-md dark:border-zinc-700"
		style:left="{menuAdjusted.left}px"
		style:top="{menuAdjusted.top}px"
		role="menu"
		aria-label="媒体操作"
	>
		<button
			type="button"
			class="flex min-h-11 w-full cursor-pointer items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
			role="menuitem"
			onclick={setAsCover}
		>
			设为封面
		</button>
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
