/**
 * 发布页分区列表：拉取与管理加载态，供 ReleasePartitionSelect 纯展示绑定。
 */
import { partitionServiceListPartitions } from '$lib/api';

/** 分区下拉选项：与 Select 组件 value/label 一致 */
export type ReleasePartitionOption = { value: string; label: string };

/**
 * 创建发布页分区列表状态：挂载后自动请求接口，并通过 getter 暴露响应式字段。
 *
 * @returns 分区数据、加载中与错误文案；供模板绑定 `ReleasePartitionSelect`
 */
export function createReleasePartitions() {
	let partitions = $state<ReleasePartitionOption[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		// effect 清理或快速重跑时丢弃未完成的请求，防止旧响应写回
		let cancelled = false;
		loading = true;
		error = null;
		(async () => {
			try {
				const { data, error: apiError } = await partitionServiceListPartitions({
					throwOnError: false
				});
				if (cancelled) return;
				if (apiError) {
					error = '加载分区列表失败';
					return;
				}
				partitions = (data?.partitions ?? [])
					.filter((p) => p?.id && p?.name)
					.map((p) => ({ value: p.id!, label: p.name! }));
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	return {
		/** 有效分区 id/name 映射后的选项列表 */
		get partitions() {
			return partitions;
		},
		/** 首次与重新拉取时为 true */
		get loading() {
			return loading;
		},
		/** 请求失败时的展示文案；成功或未请求为 null */
		get error() {
			return error;
		}
	};
}

/** `createReleasePartitions` 的返回类型 */
export type ReleasePartitionsStore = ReturnType<typeof createReleasePartitions>;
