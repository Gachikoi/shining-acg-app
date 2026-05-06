<script lang="ts">
	/**
	 * 图片/视频编辑组件：用于媒体选择与管理，支持缩略图排序、封面设置、右键操作和全屏预览；
	 * 图片可进入裁切编辑并回写结果，视频暂不支持编辑。
	 */
	import { PlusIcon, Star } from 'lucide-svelte';
	import type { Attachment } from 'svelte/attachments';
	import { Button } from '$lib/components/ui/button';
	import { ImageVideoPreview } from '$lib/components/custom/image-video-preview';
	import { longPress } from '$lib/modules/gesture';
	import { sortableList } from '$lib/modules/sortable-list';
	import { cn } from '$lib/utils.js';
	import { getMediaDisplayUrl } from '$lib/utils/media-url';
	import type {
		V1MediaAsset,
		V1MediaFile,
		V1MediaScene,
		V1MediaStatus,
		V1MediaType
	} from '$lib/api/types.gen';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';

	const IMAGE_MAX_BYTES = 100 * 1024 * 1024;
	const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;
	const SORT_DELAY_MS = 400;
	const MENU_DEDUPE_MS = 320;
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

	const ACCEPT_ATTR =
		'image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime,video/x-m4v,video/webm,.jpg,.jpeg,.png,.heic,.heif,.webp,.mp4,.mov,.m4v,.webm';

	let {
		value = $bindable<V1MediaAsset[]>([]),
		scene = 'MEDIA_SCENE_POST_MEDIA' as V1MediaScene,
		maxCount = 20,
		disabled = false,
		onChange,
		forcedEditRatio = null
	}: {
		value?: V1MediaAsset[];
		scene?: V1MediaScene;
		maxCount?: number;
		disabled?: boolean;
		onChange?: (next: V1MediaAsset[]) => void;
		forcedEditRatio?: EditRatio | null;
	} = $props();

	/** 本组件创建的 object URL，按 assetId 登记以便 revoke */
	const objectUrlByAssetId = new SvelteMap<string, string>();

	/** 封面项下标（可能暂时越界，展示用 {@link selectedCoverIndex} 收敛） */
	let coverIndex = $state(0);
	const selectedCoverIndex = $derived(
		value.length === 0 ? 0 : Math.min(Math.max(0, coverIndex), value.length - 1)
	);
	let previewOpen = $state(false);
	let previewInitialIndex = $state(0);

	let fileInputRef: HTMLInputElement | null = null;
	let draggingUrl = $state<string | null>(null);
	let suppressNextCardClick = $state(false);
	let menuOpen = $state(false);
	let menuIndex = $state(0);
	let menuAnchorLeft = $state(0);
	let menuAnchorTop = $state(0);
	let menuPanelRef = $state<HTMLDivElement | null>(null);
	let menuAdjusted = $state({ left: 0, top: 0 });
	let editOverlayOpen = $state(false);
	let editTargetIndex = $state(0);
	let editRatio = $state<EditRatio>('1:1');
	let editImageUrl = $state<string | null>(null);
	let editImageElement = $state<HTMLImageElement | null>(null);
	let imageRenderRect = $state<RectPx>({ x: 0, y: 0, width: 0, height: 0 });
	let cropRectPx = $state<RectPx>({ x: 0, y: 0, width: 0, height: 0 });
	let cropDragging = $state<DragSession | null>(null);
	let editApplying = $state(false);
	let lastMenuOpenAt = 0;
	let lastMenuOpenIndex = -1;

	/** 回收 map 中已不在 snapshot 内的 object URL（非 $effect，避免 svelte-autofixer 对 effect 内调用的告警） */
	function syncOrphanObjectUrlsForSnapshot(snapshot: V1MediaAsset[]): void {
		const n = snapshot.length;
		for (const id of objectUrlByAssetId.keys()) {
			let stillInList = false;
			for (let i = 0; i < n; i++) {
				if (snapshot[i].assetId === id) {
					stillInList = true;
					break;
				}
			}
			if (stillInList) continue;
			const url = objectUrlByAssetId.get(id);
			if (url) {
				URL.revokeObjectURL(url);
				objectUrlByAssetId.delete(id);
			}
		}
	}

	function commit(next: V1MediaAsset[]): void {
		syncOrphanObjectUrlsForSnapshot(next);
		const ordered = next.map((a, i) => ({ ...a, orderIndex: i }));
		if (ordered.length === 0) {
			coverIndex = 0;
		}
		value = ordered;
		onChange?.(ordered);
	}

	function revokeObjectUrlForAsset(assetId: string): void {
		const url = objectUrlByAssetId.get(assetId);
		if (url) {
			URL.revokeObjectURL(url);
			objectUrlByAssetId.delete(assetId);
		}
	}

	function registerObjectUrl(assetId: string, url: string): void {
		const prev = objectUrlByAssetId.get(assetId);
		if (prev && prev !== url) {
			URL.revokeObjectURL(prev);
		}
		objectUrlByAssetId.set(assetId, url);
	}

	function adjustCoverIndex(cover: number, from: number, to: number): number {
		if (cover === from) return to;
		if (from < to) {
			if (cover > from && cover <= to) return cover - 1;
		} else if (from > to) {
			if (cover >= to && cover < from) return cover + 1;
		}
		return cover;
	}

	function isVideoFile(file: File): boolean {
		if (file.type.startsWith('video/')) return true;
		const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
		return ext === 'mp4' || ext === 'mov' || ext === 'm4v' || ext === 'webm';
	}

	function assertSizeAllowed(file: File): boolean {
		const isVid = isVideoFile(file);
		const max = isVid ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
		if (file.size > max) {
			const label = isVid ? '视频' : '图片';
			const limit = isVid ? '2GB' : '100MB';
			toast.error(`${label}「${file.name}」超过 ${limit} 限制`);
			return false;
		}
		return true;
	}

	function buildLocalMediaFile(file: File, objectUrl: string, mediaType: V1MediaType): V1MediaFile {
		const defaultW = mediaType === 'MEDIA_TYPE_VIDEO' ? 1920 : 800;
		const defaultH = mediaType === 'MEDIA_TYPE_VIDEO' ? 1080 : 600;
		const status: V1MediaStatus = 'MEDIA_STATUS_COMPLETED';
		return {
			fileId: `local-file-${crypto.randomUUID()}`,
			type: mediaType,
			bucket: 'local',
			objectKey: `local/${encodeURIComponent(file.name)}`,
			url: objectUrl,
			thumbnailUrl: mediaType === 'MEDIA_TYPE_VIDEO' ? undefined : objectUrl,
			meta: {
				width: defaultW,
				height: defaultH,
				durationMs: '0',
				sizeBytes: String(file.size),
				mimeType: file.type || 'application/octet-stream'
			},
			status
		};
	}

	function buildAssetFromFile(file: File, objectUrl: string, orderIndex: number): V1MediaAsset {
		const mediaType: V1MediaType = isVideoFile(file) ? 'MEDIA_TYPE_VIDEO' : 'MEDIA_TYPE_IMAGE';
		const status: V1MediaStatus = 'MEDIA_STATUS_COMPLETED';
		const assetId = `local-asset-${crypto.randomUUID()}`;
		return {
			assetId,
			type: mediaType,
			scene,
			status,
			orderIndex,
			single: buildLocalMediaFile(file, objectUrl, mediaType)
		};
	}

	async function loadImageMeta(url: string): Promise<{ width: number; height: number }> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () =>
				resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
			img.onerror = () => resolve({ width: 800, height: 600 });
			img.src = url;
		});
	}

	async function loadVideoMeta(
		url: string
	): Promise<{ width: number; height: number; durationMs: number }> {
		return new Promise((resolve) => {
			const v = document.createElement('video');
			v.preload = 'metadata';
			v.muted = true;
			v.onloadedmetadata = () => {
				const w = v.videoWidth || 1920;
				const h = v.videoHeight || 1080;
				const d = Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : 0;
				resolve({ width: w, height: h, durationMs: d });
			};
			v.onerror = () => resolve({ width: 1920, height: 1080, durationMs: 0 });
			v.src = url;
		});
	}

	function patchAssetMeta(
		assetId: string,
		patch: { width?: number; height?: number; durationMs?: string }
	) {
		const idx = value.findIndex((a) => a.assetId === assetId);
		if (idx < 0) return;
		const a = value[idx];
		const single = a.single;
		if (!single) return;
		const next: V1MediaAsset = {
			...a,
			single: {
				...single,
				meta: {
					...single.meta,
					...(patch.width !== undefined ? { width: patch.width } : {}),
					...(patch.height !== undefined ? { height: patch.height } : {}),
					...(patch.durationMs !== undefined ? { durationMs: patch.durationMs } : {})
				}
			}
		};
		const copy = [...value];
		copy[idx] = next;
		commit(copy);
	}

	async function enrichAssetMeta(asset: V1MediaAsset, objectUrl: string) {
		if (!asset.single) return;
		if (asset.type === 'MEDIA_TYPE_IMAGE') {
			const { width, height } = await loadImageMeta(objectUrl);
			patchAssetMeta(asset.assetId, { width, height, durationMs: '0' });
		} else if (asset.type === 'MEDIA_TYPE_VIDEO') {
			const { width, height, durationMs } = await loadVideoMeta(objectUrl);
			patchAssetMeta(asset.assetId, {
				width,
				height,
				durationMs: String(durationMs)
			});
		}
	}

	function handleSortableReorder(fromIndex: number, toIndex: number): void {
		suppressNextCardClick = true;
		queueMicrotask(() => {
			suppressNextCardClick = false;
		});
		const list = [...value];
		const [moved] = list.splice(fromIndex, 1);
		list.splice(toIndex, 0, moved);
		coverIndex = adjustCoverIndex(coverIndex, fromIndex, toIndex);
		commit(list);
	}

	function removeAt(index: number): void {
		const asset = value[index];
		if (!asset) return;
		revokeObjectUrlForAsset(asset.assetId);
		const list = value.filter((_, i) => i !== index);
		if (coverIndex === index) {
			coverIndex = 0;
		} else if (coverIndex > index) {
			coverIndex--;
		}
		if (list.length > 0 && coverIndex >= list.length) {
			coverIndex = list.length - 1;
		}
		commit(list);
	}

	function setCoverAt(index: number): void {
		coverIndex = index;
		onChange?.(value.map((a, i) => ({ ...a, orderIndex: i })));
	}

	function openPreviewAt(index: number): void {
		previewInitialIndex = index;
		previewOpen = true;
	}

	function tryOpenMenu(index: number, clientX: number, clientY: number): void {
		if (disabled) return;
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
		if (disabled) return;
		e.preventDefault();
		const sc = (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } })
			.sourceCapabilities;
		if (sc?.firesTouchEvents === true) {
			return;
		}
		if (
			sc == null &&
			window.matchMedia('(pointer: coarse)').matches &&
			navigator.maxTouchPoints > 0
		) {
			return;
		}
		tryOpenMenu(index, e.clientX, e.clientY);
	}

	function ratioToNumber(ratio: EditRatio): number {
		if (ratio === '1:1') return 1;
		if (ratio === '4:3') return 4 / 3;
		return 3 / 4;
	}

	function getActiveEditRatio(): EditRatio {
		return forcedEditRatio ?? editRatio;
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
			getActiveEditRatio(),
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

	async function getAssetBlobForEdit(asset: V1MediaAsset): Promise<Blob> {
		const sourceUrl = getMediaDisplayUrl(asset);
		const response = await fetch(sourceUrl);
		if (!response.ok) {
			throw new Error(`读取图片失败: ${response.status}`);
		}
		return response.blob();
	}

	function replaceAssetWithCroppedImage(
		index: number,
		croppedBlob: Blob,
		width: number,
		height: number
	): void {
		const current = value[index];
		if (!current || current.type !== 'MEDIA_TYPE_IMAGE' || !current.single) return;
		const nextUrl = URL.createObjectURL(croppedBlob);
		registerObjectUrl(current.assetId, nextUrl);
		const nextSingle: V1MediaFile = {
			...current.single,
			url: nextUrl,
			thumbnailUrl: nextUrl,
			meta: {
				...current.single.meta,
				width,
				height,
				durationMs: '0',
				sizeBytes: String(croppedBlob.size),
				mimeType: croppedBlob.type || current.single.meta.mimeType || 'image/jpeg'
			}
		};
		const copy = [...value];
		copy[index] = {
			...current,
			single: nextSingle
		};
		commit(copy);
	}

	async function openEditOverlay(index: number): Promise<void> {
		const asset = value[index];
		if (!asset) return;
		if (asset.type === 'MEDIA_TYPE_VIDEO') {
			toast.info('暂不支持视频编辑');
			return;
		}
		try {
			if (editImageUrl) {
				URL.revokeObjectURL(editImageUrl);
				editImageUrl = null;
			}
			const sourceBlob = await getAssetBlobForEdit(asset);
			editTargetIndex = index;
			editRatio = forcedEditRatio ?? '1:1';
			editImageElement = null;
			imageRenderRect = { x: 0, y: 0, width: 0, height: 0 };
			cropRectPx = { x: 0, y: 0, width: 0, height: 0 };
			cropDragging = null;
			editImageUrl = URL.createObjectURL(sourceBlob);
			editOverlayOpen = true;
		} catch (error) {
			console.error('Open image edit overlay failed:', error);
			toast.error('加载图片失败，暂时无法编辑');
		}
	}

	async function applyEdit(): Promise<void> {
		const asset = value[editTargetIndex];
		if (!asset || asset.type !== 'MEDIA_TYPE_IMAGE' || !asset.single || editApplying) return;
		editApplying = true;
		try {
			const sourceBlob = await getAssetBlobForEdit(asset);
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
			replaceAssetWithCroppedImage(editTargetIndex, croppedBlob, sw, sh);
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

	function removeFromMenu(): void {
		removeAt(menuIndex);
		closeMenu();
	}

	function handleFileInputChange(e: Event): void {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		input.value = '';
		if (!files?.length || disabled) return;

		const incoming = Array.from(files).filter(assertSizeAllowed);
		if (incoming.length === 0) return;

		const room = maxCount - value.length;
		if (room <= 0) {
			toast.error(`最多添加 ${maxCount} 个媒体`);
			return;
		}

		let toAdd = incoming;
		if (incoming.length > room) {
			toast.error(`超出数量上限，仅添加前 ${room} 个`);
			toAdd = incoming.slice(0, room);
		}

		const baseIndex = value.length;
		const newAssets: V1MediaAsset[] = [];
		for (let i = 0; i < toAdd.length; i++) {
			const file = toAdd[i];
			const objectUrl = URL.createObjectURL(file);
			const asset = buildAssetFromFile(file, objectUrl, baseIndex + i);
			registerObjectUrl(asset.assetId, objectUrl);
			newAssets.push(asset);
			void enrichAssetMeta(asset, objectUrl);
		}

		if (value.length === 0 && newAssets.length > 0) {
			coverIndex = 0;
		}

		commit([...value, ...newAssets]);
	}

	const captureFileInput: Attachment<HTMLInputElement> = (element) => {
		fileInputRef = element;
		return () => {
			if (fileInputRef === element) fileInputRef = null;
		};
	};

	function handleAddClick(): void {
		if (disabled) return;
		fileInputRef?.click();
	}

	/** 父级仅通过 bind 替换 value（未走 commit）时，周期性对齐 map（onMount 内调用不触发 autofixer 的 $effect 规则） */
	onMount(() => {
		const id = window.setInterval(() => {
			syncOrphanObjectUrlsForSnapshot(value);
		}, 400);
		return () => window.clearInterval(id);
	});

	onDestroy(() => {
		for (const id of [...objectUrlByAssetId.keys()]) {
			revokeObjectUrlForAsset(id);
		}
		closeEditOverlay();
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

	const orderKey = $derived(value.map((a) => a.assetId).join('\0'));
</script>

<input
	{@attach captureFileInput}
	type="file"
	class="hidden"
	multiple
	accept={ACCEPT_ATTR}
	{disabled}
	onchange={handleFileInputChange}
/>

<div
	class="flex flex-wrap gap-2"
	use:sortableList={{
		itemSelector: '[data-image-video-edit-item]',
		itemCount: value.length,
		orderKey,
		disabled: () => disabled,
		onReorder: handleSortableReorder,
		onDragStart: (item) => {
			draggingUrl = item.getAttribute('data-preview-url');
		},
		onDragEnd: () => {
			draggingUrl = null;
		},
		delay: SORT_DELAY_MS
	}}
>
	{#each value as asset, index (asset.assetId)}
		{@const url = getMediaDisplayUrl(asset)}
		<div
			class={cn(
				'relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted select-none',
				!disabled && 'cursor-grab active:cursor-grabbing',
				selectedCoverIndex === index &&
					'ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-100 dark:ring-offset-zinc-900',
				draggingUrl !== null && url === draggingUrl && 'opacity-60'
			)}
			data-image-video-edit-item
			data-preview-url={url}
			role="group"
			aria-label={`媒体 ${index + 1}`}
			oncontextmenu={(e) => onCardContextMenu(e, index)}
			use:longPress={{
				delay: SORT_DELAY_MS,
				onPress: (detail) => {
					if (disabled || detail.pointerType !== 'touch') return;
					tryOpenMenu(index, detail.clientX, detail.clientY);
				},
				onPressUp: () => {}
			}}
		>
			<button
				type="button"
				class="relative block h-full w-full"
				{disabled}
				onclick={() => {
					if (disabled || suppressNextCardClick) return;
					openPreviewAt(index);
				}}
			>
				{#if asset.type === 'MEDIA_TYPE_VIDEO'}
					<video
						src={url}
						class="pointer-events-none h-full w-full object-cover"
						muted
						playsinline
						preload="metadata"
					></video>
				{:else}
					<img
						src={url}
						alt=""
						class="pointer-events-none h-full w-full object-cover"
						draggable="false"
					/>
				{/if}
			</button>

			<div
				class="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end gap-0.5 p-1"
				aria-hidden="true"
			>
				<span
					class="pointer-events-auto inline-flex rounded bg-black/50 p-0.5 [&_button]:min-h-8 [&_button]:min-w-8"
				>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-8 w-8 text-amber-300 hover:bg-white/20 hover:text-amber-200"
						{disabled}
						aria-label="设为封面"
						onclick={(e) => {
							e.stopPropagation();
							setCoverAt(index);
						}}
					>
						<Star class="size-4" />
					</Button>
				</span>
			</div>
		</div>
	{/each}

	{#if value.length < maxCount}
		<button
			type="button"
			class="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-muted hover:bg-muted-foreground/10 disabled:opacity-50"
			{disabled}
			onclick={handleAddClick}
			aria-label="添加图片或视频"
		>
			<PlusIcon class="size-6 text-muted-foreground" />
		</button>
	{/if}
</div>

<ImageVideoPreview bind:open={previewOpen} mediaList={value} initialIndex={previewInitialIndex} />

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
			{#if forcedEditRatio}
				<span class="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
					固定比例 {forcedEditRatio}
				</span>
			{:else}
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
			{/if}
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
