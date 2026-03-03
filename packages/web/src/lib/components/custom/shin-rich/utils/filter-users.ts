import type { MentionUser } from '../components/shin-rich-popover.svelte';

/** 过滤用户列表（按 qq、name、remark 搜索）
 * 需求 6.2.5.1-3：@ 后输入字符时，将输入视作对用户的查找，支持 QQ 号、用户昵称、备注
 */
export function filterUsersByQuery(users: MentionUser[], query: string): MentionUser[] {
	if (!query.trim()) return users;
	const q = query.trim().toLowerCase();
	return users.filter(
		(u) =>
			u.qq.toLowerCase().includes(q) ||
			u.name.toLowerCase().includes(q) ||
			u.remark?.toLowerCase().includes(q)
	);
}
