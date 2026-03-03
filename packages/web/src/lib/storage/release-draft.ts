/**
 * 发布页草稿 IndexedDB 持久化
 * 用于保存、加载、清除发布表单草稿
 * 需求 6.2.5.2-2：保存/自动保存后持久化，用户再次打开从缓存恢复
 * TODO(6.2.5.4-7): 取消上传时二次确认后清除缓存和已上传内容
 */

import { browser } from '$app/environment';
import type { V1PostContentUnit } from '$lib/api/types.gen';

const DB_NAME = 'shining-acg-release';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DEFAULT_DRAFT_ID = 'release-draft';

/** 封面比例，与发布页 UI 共用 */
export const CoverRatioArray = ['1:1', '4:3', '3:4'] as const;
export type CoverRatio = (typeof CoverRatioArray)[number];

export interface ReleaseDraft {
	id: string;
	updatedAt: string;
	isAutoSave: boolean;
	title: string;
	bodyContent: V1PostContentUnit[];
	selectedSection: string;
	coverRatio: CoverRatio;
	coverDataURL: string | null;
	mediaDataURLs: string[];
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'id' });
			}
		};
	});
}

export async function saveReleaseDraft(draft: ReleaseDraft): Promise<void> {
	if (!browser) return;
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.put(draft);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
		tx.oncomplete = () => db.close();
	});
}

export async function loadReleaseDraft(
	id: string = DEFAULT_DRAFT_ID
): Promise<ReleaseDraft | null> {
	if (!browser) return null;
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const request = store.get(id);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			resolve((request.result as ReleaseDraft) ?? null);
		};
		tx.oncomplete = () => db.close();
	});
}

export async function clearReleaseDraft(id: string = DEFAULT_DRAFT_ID): Promise<void> {
	if (!browser) return;
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const request = store.delete(id);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
		tx.oncomplete = () => db.close();
	});
}
