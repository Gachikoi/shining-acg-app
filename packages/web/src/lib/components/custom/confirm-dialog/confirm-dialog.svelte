<script lang="ts">
	/**
	 * 确认对话框组件
	 *
	 * 基于 AlertDialog 封装的二次确认弹窗，用于在执行关键操作前让用户确认。
	 * 常用于删除、重置等重要操作的确认场景。
	 */
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import type { Snippet } from 'svelte';

	type ConfirmDialogProps = {
		onConfirm: () => void; /** 用户点击确认按钮时的回调函数 */
		triggerClass?: string; /** 触发按钮的 CSS 类名，用于自定义样式 */
		triggerText: string; /** 触发按钮显示的文本 */
		title?: Snippet; /** 对话框标题，支持 Snippet 插槽 */
		description?: Snippet; /** 对话框描述内容，支持 Snippet 插槽 */
		confirmText?: string; /** 确认按钮文本，默认「确定」 */
		cancelText?: string; /** 取消按钮文本，默认「取消」 */
	};

	let {
		onConfirm,
		triggerClass,
		triggerText,
		title,
		description,
		confirmText = '确定',
		cancelText = '取消'
	}: ConfirmDialogProps = $props();

	/** 控制对话框的显示/隐藏状态 */
	let isResetDialogOpen = $state(false);

	const handleConfirm = () => {
		onConfirm();
		isResetDialogOpen = false;
	};
</script>

<AlertDialog.Root bind:open={isResetDialogOpen}>
	<AlertDialog.Trigger class={triggerClass}>
		{triggerText}
	</AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			{#if title}
				<AlertDialog.Title>
					{@render title()}
				</AlertDialog.Title>
			{/if}
			{#if description}
				<AlertDialog.Description>
					{@render description()}
				</AlertDialog.Description>
			{/if}
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{cancelText}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleConfirm}>{confirmText}</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
