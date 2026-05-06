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
	import { toast } from 'svelte-sonner';
	import { Label } from '$lib/components/ui/label';
	import { sortableList } from '$lib/modules/sortable-list';
	import { getPreviewBlob } from '$lib/modules/release-media';
	import { isImageItem } from '$lib/modules/media-cover';
	import type { DraftMediaItem } from '$lib/stores/release';
	import { cn } from '$lib/utils.js';
	import { longPress } from '$lib/modules/gesture';

	/** 连点/右键与单击合并为单次打开（ms） */
	const MENU_DEDUPE_MS = 320;
	/** 拖动延迟（ms） */
	const DELAY = 400;
	const EDIT_RATIO_OPTIONS = ['1:1', '4:3', '3:4'] as const;
	type EditRatio = (typeof EDIT_RATIO_OPTIONS)[number];
	type RectPx = { x: number; y: number; width: number; height: number };
	type DragSession = {
		pointerId: number;
		startClientX: number;
		startClientY: number;
		startX: number;
		startY: number;
	};

	let {
		items,
		urls,
		maxCount,
		onFileSelect,
		onRemove,
		selectedCoverIndex,
		onSelectCoverIndex,
		onReorder,
		mediaInteractionsDisabled,
		onEditImage
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
		/** 图片编辑完成回调：返回原索引与裁切 Blob */
		onEditImage: (payload: {
			index: number;
			blob: Blob;
			mimeType?: string;
			name?: string;
		}) => void | Promise<void>;
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
	let editOverlayOpen = $state(false);
	let editTargetIndex = $state(0);
	let editRatio = $state<EditRatio>('1:1');
	let editImageUrl = $state<string | null>(null);
	let editSourceBlob = $state<Blob | null>(null);
	let editSourceName = $state('cropped-image.jpg');
	let editImageElement = $state<HTMLImageElement | null>(null);
	let imageRenderRect = $state<RectPx>({ x: 0, y: 0, width: 0, height: 0 });
	let cropRectPx = $state<RectPx>({ x: 0, y: 0, width: 0, height: 0 });
	let cropDragging = $state<DragSession | null>(null);
	let editApplying = $state(false);

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

	function ratioToNumber(ratio: EditRatio): number {
		if (ratio === '1:1') return 1;
		if (ratio === '4:3') return 4 / 3;
		return 3 / 4;
	}

	function clamp(value: number, min: number, max: number): number {
		if (value < min) return min;
		if (value > max) return max;
		return value;
	}

	function buildCropRectByRatio(
		renderWidth: number,
		renderHeight: number,
		ratio: EditRatio,
		centerX: number,
		centerY: number
	): RectPx {
		const target = ratioToNumber(ratio);
		const source = renderWidth / renderHeight;
		let width = renderWidth;
		let height = renderHeight;
		if (source >= target) {
			height = renderHeight;
			width = height * target;
		} else {
			width = renderWidth;
			height = width / target;
		}
		const maxX = Math.max(0, renderWidth - width);
		const maxY = Math.max(0, renderHeight - height);
		const x = clamp(centerX - width / 2, 0, maxX);
		const y = clamp(centerY - height / 2, 0, maxY);
		return { x, y, width, height };
	}

	function syncRenderRectAndCrop(preserveCenter: boolean): void {
		const image = editImageElement;
		if (!image) return;
		const nextRenderWidth = image.clientWidth;
		const nextRenderHeight = image.clientHeight;
		if (nextRenderWidth <= 0 || nextRenderHeight <= 0) return;
		const prevRenderRect = imageRenderRect;
		const prevCropRect = cropRectPx;
		imageRenderRect = { x: 0, y: 0, width: nextRenderWidth, height: nextRenderHeight };
		let centerX = nextRenderWidth / 2;
		let centerY = nextRenderHeight / 2;
		if (
			preserveCenter &&
			prevRenderRect.width > 0 &&
			prevRenderRect.height > 0 &&
			prevCropRect.width > 0 &&
			prevCropRect.height > 0
		) {
			const centerPercentX = (prevCropRect.x + prevCropRect.width / 2) / prevRenderRect.width;
			const centerPercentY = (prevCropRect.y + prevCropRect.height / 2) / prevRenderRect.height;
			centerX = centerPercentX * nextRenderWidth;
			centerY = centerPercentY * nextRenderHeight;
		}
		cropRectPx = buildCropRectByRatio(
			nextRenderWidth,
			nextRenderHeight,
			editRatio,
			centerX,
			centerY
		);
	}

	function getCropGuideStyle(): string {
		return `left:${cropRectPx.x}px;top:${cropRectPx.y}px;width:${cropRectPx.width}px;height:${cropRectPx.height}px;`;
	}

	function mapCropRectToSourceRect(
		naturalWidth: number,
		naturalHeight: number
	): { sx: number; sy: number; sw: number; sh: number } {
		const renderWidth = imageRenderRect.width;
		const renderHeight = imageRenderRect.height;
		if (renderWidth <= 0 || renderHeight <= 0 || cropRectPx.width <= 0 || cropRectPx.height <= 0) {
			return {
				sx: 0,
				sy: 0,
				sw: Math.max(1, naturalWidth),
				sh: Math.max(1, naturalHeight)
			};
		}
		const scaleX = naturalWidth / renderWidth;
		const scaleY = naturalHeight / renderHeight;
		const sx = clamp(Math.round(cropRectPx.x * scaleX), 0, Math.max(0, naturalWidth - 1));
		const sy = clamp(Math.round(cropRectPx.y * scaleY), 0, Math.max(0, naturalHeight - 1));
		const sw = clamp(Math.round(cropRectPx.width * scaleX), 1, Math.max(1, naturalWidth - sx));
		const sh = clamp(Math.round(cropRectPx.height * scaleY), 1, Math.max(1, naturalHeight - sy));
		return { sx, sy, sw, sh };
	}

	function stopCropDrag(pointerId?: number): void {
		if (cropDragging && (pointerId === undefined || cropDragging.pointerId === pointerId)) {
			cropDragging = null;
		}
	}

	function onCropPointerDown(event: PointerEvent): void {
		if (editApplying || imageRenderRect.width <= 0 || imageRenderRect.height <= 0) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		const currentTarget = event.currentTarget;
		if (!(currentTarget instanceof HTMLElement)) return;
		currentTarget.setPointerCapture(event.pointerId);
		cropDragging = {
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startX: cropRectPx.x,
			startY: cropRectPx.y
		};
		event.preventDefault();
	}

	function onCropPointerMove(event: PointerEvent): void {
		const session = cropDragging;
		if (!session || session.pointerId !== event.pointerId) return;
		const nextX = session.startX + (event.clientX - session.startClientX);
		const nextY = session.startY + (event.clientY - session.startClientY);
		const maxX = Math.max(0, imageRenderRect.width - cropRectPx.width);
		const maxY = Math.max(0, imageRenderRect.height - cropRectPx.height);
		cropRectPx = {
			...cropRectPx,
			x: clamp(nextX, 0, maxX),
			y: clamp(nextY, 0, maxY)
		};
	}

	function onCropPointerUp(event: PointerEvent): void {
		const currentTarget = event.currentTarget;
		if (currentTarget instanceof HTMLElement && currentTarget.hasPointerCapture(event.pointerId)) {
			currentTarget.releasePointerCapture(event.pointerId);
		}
		stopCropDrag(event.pointerId);
	}

	function onCropPointerCancel(event: PointerEvent): void {
		stopCropDrag(event.pointerId);
	}

	function closeEditOverlay(): void {
		editOverlayOpen = false;
		editApplying = false;
		editImageElement = null;
		imageRenderRect = { x: 0, y: 0, width: 0, height: 0 };
		cropRectPx = { x: 0, y: 0, width: 0, height: 0 };
		cropDragging = null;
		editSourceBlob = null;
		if (editImageUrl) {
			URL.revokeObjectURL(editImageUrl);
			editImageUrl = null;
		}
	}

	async function loadImageElementFromBlob(blob: Blob): Promise<HTMLImageElement> {
		const url = URL.createObjectURL(blob);
		try {
			const image = await new Promise<HTMLImageElement>((resolve, reject) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = () => reject(new Error('图片加载失败'));
				img.src = url;
			});
			return image;
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
		return new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) {
					resolve(blob);
					return;
				}
				reject(new Error('图片导出失败'));
			}, type);
		});
	}

	async function openEditOverlay(index: number): Promise<void> {
		const item = items[index];
		if (!item) return;
		if (item.kind !== 'single' || !isImageItem(item)) {
			toast.info('暂不支持视频编辑');
			return;
		}
		try {
			if (editImageUrl) {
				URL.revokeObjectURL(editImageUrl);
				editImageUrl = null;
			}
			const sourceBlob = getPreviewBlob(item);
			editTargetIndex = index;
			editRatio = '1:1';
			editImageElement = null;
			imageRenderRect = { x: 0, y: 0, width: 0, height: 0 };
			cropRectPx = { x: 0, y: 0, width: 0, height: 0 };
			cropDragging = null;
			editSourceBlob = sourceBlob;
			editSourceName = item.name || 'cropped-image.jpg';
			editImageUrl = URL.createObjectURL(sourceBlob);
			editOverlayOpen = true;
		} catch (error) {
			console.error('Open image edit overlay failed:', error);
			toast.error('加载图片失败，暂时无法编辑');
		}
	}

	async function applyEdit(): Promise<void> {
		const sourceBlob = editSourceBlob;
		if (!sourceBlob || editApplying) return;
		editApplying = true;
		try {
			const image = await loadImageElementFromBlob(sourceBlob);
			const { sx, sy, sw, sh } = mapCropRectToSourceRect(image.naturalWidth, image.naturalHeight);
			const canvas = document.createElement('canvas');
			canvas.width = sw;
			canvas.height = sh;
			const context = canvas.getContext('2d');
			if (!context) {
				throw new Error('无法创建画布上下文');
			}
			context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
			const outputType = sourceBlob.type.startsWith('image/') ? sourceBlob.type : 'image/jpeg';
			const croppedBlob = await canvasToBlob(canvas, outputType);
			await onEditImage({
				index: editTargetIndex,
				blob: croppedBlob,
				mimeType: outputType,
				name: editSourceName
			});
			closeEditOverlay();
		} catch (error) {
			console.error('Apply image edit failed:', error);
			toast.error('图片编辑失败，请重试');
			editApplying = false;
		}
	}

	function openEditFromMenu(): void {
		const index = menuIndex;
		closeMenu();
		void openEditOverlay(index);
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

	$effect(() => {
		const opened = editOverlayOpen;
		void opened;
		if (!opened) return;
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				closeEditOverlay();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		const onResize = (): void => {
			syncRenderRectAndCrop(true);
		};
		window.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', onResize);
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
			onclick={openEditFromMenu}
		>
			编辑
		</button>
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

{#if editOverlayOpen && editImageUrl}
	<div
		class="fixed inset-0 z-70 flex flex-col bg-black/95 text-zinc-100"
		role="dialog"
		aria-modal="true"
		aria-label="图片编辑"
	>
		<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
			<button
				type="button"
				class="min-h-11 min-w-11 rounded-md px-3 text-sm hover:bg-zinc-800"
				onclick={closeEditOverlay}
				disabled={editApplying}
			>
				取消
			</button>
			<p class="text-sm font-medium">图片编辑</p>
			<button
				type="button"
				class="min-h-11 min-w-11 rounded-md bg-zinc-100 px-3 text-sm font-medium text-zinc-900 disabled:opacity-50"
				onclick={applyEdit}
				disabled={editApplying}
			>
				{editApplying ? '处理中...' : '完成'}
			</button>
		</div>

		<div class="flex items-center justify-center gap-2 border-b border-zinc-800 px-4 py-3">
			{#each EDIT_RATIO_OPTIONS as ratio (ratio)}
				<button
					type="button"
					class={cn(
						'min-h-11 rounded-full border px-4 text-sm',
						editRatio === ratio
							? 'border-zinc-100 bg-zinc-100 text-zinc-900'
							: 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
					)}
					onclick={() => {
						editRatio = ratio;
						syncRenderRectAndCrop(true);
					}}
				>
					{ratio}
				</button>
			{/each}
		</div>

		<div class="min-h-0 flex-1 p-4">
			<div class="relative mx-auto flex h-full max-w-4xl items-center justify-center">
				<div class="relative max-h-full max-w-full overflow-hidden rounded-lg">
					<img
						bind:this={editImageElement}
						src={editImageUrl}
						alt="编辑中的图片"
						class="block max-h-[calc(100vh-12rem)] max-w-full object-contain"
						draggable="false"
						onload={() => {
							syncRenderRectAndCrop(false);
						}}
					/>
					<div
						class="pointer-events-none absolute border-2 border-zinc-100 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
						style={getCropGuideStyle()}
					>
						<div
							class="pointer-events-auto h-full w-full cursor-move touch-none"
							role="presentation"
							aria-label="拖动裁切区域"
							onpointerdown={onCropPointerDown}
							onpointermove={onCropPointerMove}
							onpointerup={onCropPointerUp}
							onpointercancel={onCropPointerCancel}
						></div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
