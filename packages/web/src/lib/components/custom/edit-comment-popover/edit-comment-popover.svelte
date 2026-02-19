<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { V1Comment } from '$lib/api';

	/**
	 * 编辑评论弹窗 - 可调用 UI 占位（放在 Popover.Content 内使用）
	 * 后续开发：上传图片最多 6 张、@ 用户、富文本等（见产品需求 6.2.8.3）
	 */
	let {
		replyTo = null as V1Comment | null,
		placeholder = '写下评论…',
		onSubmit = async (_content: string, _replyTo: V1Comment | null) => {
			// 默认实现只为满足类型签名，不做实际提交
			await Promise.resolve({ _content, _replyTo });
		},
		onCancel = () => {}
	}: {
		replyTo?: V1Comment | null;
		placeholder?: string;
		onSubmit?: (content: string, replyTo: V1Comment | null) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	let content = $state('');
	let submitting = $state(false);

	const displayPlaceholder = $derived(
		!replyTo ? placeholder : `回复 @${replyTo.author?.name ?? '用户'}`
	);

	async function handleSubmit() {
		const text = content.trim();
		if (!text || submitting) return;
		submitting = true;
		try {
			await onSubmit(text, replyTo);
			content = '';
			onCancel();
		} finally {
			submitting = false;
		}
	}
</script>

{#if replyTo}
	<p class="mb-2 text-xs text-zinc-500">回复 @{replyTo.author?.name ?? '用户'}</p>
{/if}
<textarea
	class="mb-2 w-full resize-none rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
	rows="3"
	placeholder={displayPlaceholder}
	maxlength="300"
	bind:value={content}
></textarea>
<div class="flex justify-end gap-2">
	<Button variant="ghost" size="sm" onclick={onCancel}>取消</Button>
	<Button size="sm" onclick={handleSubmit} disabled={!content.trim() || submitting}>
		{submitting ? '发送中…' : '发送'}
	</Button>
</div>
