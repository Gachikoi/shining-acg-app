import type { PrepareUploadParamAsset, PrepareUploadParams, PrepareUploadSelection } from './types';

/**
 * Live Photo 命名规则：
 * - lp_<groupId>_image.xxx
 * - lp_<groupId>_video.xxx
 */
const LIVE_PHOTO_FILE_RE = /^lp_([A-Za-z0-9_-]+)_(image|video)\.[^.]+$/i;

type LivePhotoSlot = {
	firstIndex: number;
	image?: File;
	video?: File;
};

type OrderedEntry =
	| {
			index: number;
			type: 'single';
			asset: PrepareUploadParamAsset;
	  }
	| {
			index: number;
			type: 'live_photo';
			groupId: string;
			slot: LivePhotoSlot;
	  };

/**
 * 兼容 FileList / File[]。
 */
function toArray(files: FileList | File[]): File[] {
	return Array.isArray(files) ? files : Array.from(files);
}

/**
 * 按文件名获取可选哈希（用于后端去重/校验）。
 */
function getFileHash(selection: PrepareUploadSelection, file: File): string | undefined {
	return selection.fileHashByName?.[file.name]?.trim() || undefined;
}

/**
 * 将一组选择器输入转换为 PrepareUploadParams。
 * - 普通文件 -> single
 * - 命中 Live Photo 命名规则的文件 -> 按 groupId 配对为 live_photo
 */
function selectionToAssets(selection: PrepareUploadSelection): PrepareUploadParams {
	const files = toArray(selection.files);
	const livePhotoGroups = new Map<string, LivePhotoSlot>();
	const ordered: OrderedEntry[] = [];

	for (const [index, file] of files.entries()) {
		const matched = LIVE_PHOTO_FILE_RE.exec(file.name);
		if (!matched) {
			ordered.push({
				index,
				type: 'single',
				asset: {
					kind: 'single',
					scene: selection.scene,
					single: {
						file,
						fileHash: getFileHash(selection, file)
					},
					// cropCover 是元素级属性，挂载在 asset 上而非 single 文件上
					cropCover: selection.cropCover
				}
			});
			continue;
		}

		const groupId = matched[1];
		const role = matched[2].toLowerCase();
		const slot = livePhotoGroups.get(groupId) ?? { firstIndex: index };
		slot.firstIndex = Math.min(slot.firstIndex, index);
		if (role === 'image') {
			slot.image = file;
		} else {
			slot.video = file;
		}
		livePhotoGroups.set(groupId, slot);
	}

	for (const [groupId, slot] of livePhotoGroups.entries()) {
		ordered.push({
			index: slot.firstIndex,
			type: 'live_photo',
			groupId,
			slot
		});
	}

	ordered.sort((a, b) => a.index - b.index);

	return ordered.map((entry) => {
		if (entry.type === 'single') {
			return entry.asset;
		}
		if (!entry.slot.image || !entry.slot.video) {
			throw new Error(`Live Photo 组 ${entry.groupId} 缺少 image 或 video 文件`);
		}
		return {
			kind: 'live_photo',
			scene: selection.scene,
			livePhoto: {
				image: {
					file: entry.slot.image,
					fileHash: getFileHash(selection, entry.slot.image)
				},
				video: {
					file: entry.slot.video,
					fileHash: getFileHash(selection, entry.slot.video)
				}
			},
			// Live Photo 与 single 共享同一 selection 的 cropCover，裁剪作用于图片轨
			cropCover: selection.cropCover
		};
	});
}

/**
 * 业务侧便捷函数：把“文件选择结果”转换为 uploader.upload 可用的 asset 列表。
 *
 * @example
 * const params = buildPrepareUploadParams({ scene, files });
 * const uploader = createMediaUploader();
 * await uploader.upload(params);
 */
export function buildPrepareUploadParams(
	input: PrepareUploadSelection | PrepareUploadSelection[]
): PrepareUploadParams {
	const selections = Array.isArray(input) ? input : [input];
	return selections.flatMap((selection) => selectionToAssets(selection));
}
