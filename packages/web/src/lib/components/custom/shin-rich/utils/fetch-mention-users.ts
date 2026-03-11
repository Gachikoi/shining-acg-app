/**
 * 从关注列表获取 @ 提及用户列表。
 * 需求 6.2.5.1-3：优先使用关注列表，若凑不齐 20 人则从现网用户中补充（缺后端 API，暂未实现）。
 */
import { userServiceGetMe, userServiceListUserFollowings } from '$lib/api';
import type { MentionUser } from '../components/shin-rich-popover.svelte';
import { filterUsersByQuery } from './filter-users';

const MENTION_NEED_NUM = 20;

/**
 * 创建 fetchMentionUsers 函数。
 * 返回 (query: string) => Promise<MentionUser[]>
 * - 优先从 cachedFollowingUsers（关注列表）中取符合 query 的用户加入结果
 * - 若已满 20 人则直接返回，否则调用现网用户 API 补充（目前留空）
 * - cachedFollowingUsers 在闭包内缓存，同一次页面会话内仅首次会请求关注列表 API
 */
export function createFetchMentionUsersFromFollowings(): (query: string) => Promise<MentionUser[]> {
	let cachedFollowingUsers: MentionUser[] | null = null;

	return async (query: string): Promise<MentionUser[]> => {
		try {
			const users: MentionUser[] = [];

			// 1. 确保有关注列表缓存
			if (cachedFollowingUsers === null) {
				const { data: meData, error: meError } = await userServiceGetMe({
					throwOnError: false
				});
				if (meError || !meData?.profile?.userId) {
					console.error('get me data error', meError);
					return [];
				}
				const { data, error } = await userServiceListUserFollowings({
					path: { userId: meData.profile.userId },
					query: {
						refreshType: 'REFRESH_TYPE_PULL_DOWN',
						'pagination.needNum': MENTION_NEED_NUM
					},
					throwOnError: false
				});
				if (error || !data?.users) {
					console.error('get following users error', error);
					return [];
				}
				cachedFollowingUsers = data.users
					.filter(
						(item): item is { info: NonNullable<typeof item.info> & { userId: string } } =>
							!!item?.info && (item.info.userId ?? '') !== ''
					)
					.map((item) => {
						const info = item.info;
						return {
							id: info.userId ?? '',
							qq: info.qqNumber ?? '',
							name: info.name ?? '',
							avatar: info.avatar || undefined,
							remark: info.remark
						} satisfies MentionUser;
					});
			}

			// 2. 从关注列表中取符合 query 的，加入 users
			const matchingFromFollowings = filterUsersByQuery(cachedFollowingUsers, query);
			for (const u of matchingFromFollowings) {
				if (users.length >= MENTION_NEED_NUM) break;
				users.push(u);
			}

			// 3. 若未满 20 人，从现网用户 API 补充（缺后端 API，暂留空）
			if (users.length < MENTION_NEED_NUM) {
				// TODO: const onlineUsers = await fetchOnlineUsers(query, MENTION_NEED_NUM - users.length);
				// for (const u of onlineUsers) { if (users.length >= MENTION_NEED_NUM) break; users.push(u); }
			}

			return users;
		} catch {
			return [];
		}
	};
}
