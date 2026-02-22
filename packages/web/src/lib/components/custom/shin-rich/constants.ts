import type { MentionUser } from './shin-rich-popover.svelte';

/** 过滤用户列表（按 qq、name、remark 搜索） */
export function filterUsersByQuery(users: MentionUser[], query: string): MentionUser[] {
	if (!query.trim()) return users;
	const q = query.trim().toLowerCase();
	return users.filter(
		(u) =>
			u.qq.toLowerCase().includes(q) ||
			u.name.toLowerCase().includes(q) ||
			(u as MentionUser & { remark?: string }).remark?.toLowerCase().includes(q)
	);
}
