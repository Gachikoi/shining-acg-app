/**
 * 从关注列表获取 @ 提及用户列表。
 * 需求 6.2.5.1-3：@ 后无输入时从关注列表获取 20 人；有输入时由 ShinRichTextarea 内 filterUsersByQuery 做前端过滤。
 */
import { userServiceGetMe, userServiceListUserFollowings } from '$lib/api';
import type { MentionUser } from '../components/shin-rich-popover.svelte';

const MENTION_NEED_NUM = 20;

/**
 * 创建基于关注列表的 fetchMentionUsers 函数。
 * 返回 (query: string) => Promise<MentionUser[]>
 * - 未登录或 API 失败时返回 []
 * - query 由 ShinRichTextarea 内 filterUsersByQuery 做前端过滤，此处不传 filter.keyword
 */
export function createFetchMentionUsersFromFollowings(): (query: string) => Promise<MentionUser[]> {
	return async (_query: string): Promise<MentionUser[]> => {
		try {
			const { data: meData, error: meError } = await userServiceGetMe({
				throwOnError: false
			});
			if (meError || !meData?.profile?.userId) {
				return [];
			}
			const userId = meData.profile.userId;

			const { data, error } = await userServiceListUserFollowings({
				path: { userId },
				query: {
					refreshType: 'REFRESH_TYPE_PULL_DOWN',
					'pagination.needNum': MENTION_NEED_NUM
				},
				throwOnError: false
			});

			if (error || !data?.users) {
				return [];
			}

			return data.users
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
		} catch {
			return [];
		}
	};
}
