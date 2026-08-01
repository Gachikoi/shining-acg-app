<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { cn } from '$lib/utils';
	import { buttonVariants } from '$lib/components/ui/button';
	import type { MessagesState } from './messages-state.svelte';

	let { state }: { state: MessagesState } = $props();

	const reportOpen = $derived(state.dialogType === 'report');
	const deleteOpen = $derived(state.dialogType === 'delete');
	const targetId = $derived(state.dialogTargetId);

	const dangerActionClass = cn(
		buttonVariants({ variant: 'default' }),
		'bg-red-500 text-white hover:bg-red-600'
	);
</script>

<AlertDialog.Root
	open={reportOpen}
	onOpenChange={(open) => {
		if (!open) state.cancelDialog();
	}}
>
	<AlertDialog.Content interactOutsideBehavior="close" escapeKeydownBehavior="close">
		<AlertDialog.Header>
			<AlertDialog.Title>举报会话</AlertDialog.Title>
			<AlertDialog.Description>
				确定要举报该会话吗？我们会尽快处理您的反馈。
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>取消</AlertDialog.Cancel>
			<AlertDialog.Action
				class={dangerActionClass}
				onclick={() => {
					if (targetId) state.confirmReport(targetId);
				}}
			>
				确认举报
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
	open={deleteOpen}
	onOpenChange={(open) => {
		if (!open) state.cancelDialog();
	}}
>
	<AlertDialog.Content interactOutsideBehavior="close" escapeKeydownBehavior="close">
		<AlertDialog.Header>
			<AlertDialog.Title>删除会话</AlertDialog.Title>
			<AlertDialog.Description>
				确定要删除该会话吗？本地消息将被移除，此操作不可撤销。
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>取消</AlertDialog.Cancel>
			<AlertDialog.Action
				class={dangerActionClass}
				onclick={() => {
					if (targetId) state.confirmDelete(targetId);
				}}
			>
				确认删除
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
