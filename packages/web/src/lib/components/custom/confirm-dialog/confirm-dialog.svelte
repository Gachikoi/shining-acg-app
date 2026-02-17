<!--
  @component
  ## ConfirmDialog - 确认对话框组件

  基于 AlertDialog 封装的二次确认弹窗，用于在执行关键操作前让用户确认。
  常用于删除、重置、提交等重要操作的确认场景。

  ### 使用方式

  **1. 声明式（带 trigger）** - 提供 trigger snippet，点击触发元素打开弹窗:

  ```svelte
  <ConfirmDialog onConfirm={handleDelete} confirmVariant="secondary">
    {#snippet trigger()}
      <Button>删除</Button>
    {/snippet}
    {#snippet description()}
      <p>确定要删除吗？此操作不可撤销。</p>
    {/snippet}
  </ConfirmDialog>
  ```

  **2. 受控模式（无 trigger）** - 不提供 trigger，通过 bind:open 由外部控制显示:

  ```svelte
  let showConfirm = $state(false);
  <ConfirmDialog bind:open={showConfirm} onConfirm={handleSubmit}>
    {#snippet description()}<p>确定提交？</p>{/snippet}
  </ConfirmDialog>
  <Button onclick={() => showConfirm = true}>提交</Button>
  ```

  ### 回调说明

  - onConfirm: 点击确认时调用，支持 async；执行期间确认按钮显示 loading 并禁用
  - onCancel: 点击取消、按 ESC 或点击遮罩关闭时调用
  - onError: onConfirm 抛出错误时调用，错误会继续向上抛出，弹窗保持打开
-->
<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { buttonVariants, type ButtonVariant } from '$lib/components/ui/button';
	import { LoaderCircle } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	type ConfirmDialogProps = {
		/** 受控模式：外部控制显示/隐藏 */
		open?: boolean;
		/** 用户点击确认按钮时的回调函数，支持 async */
		onConfirm: () => void | Promise<void>;
		/** 用户点击取消、按 ESC 或点击遮罩关闭时的回调函数 */
		onCancel?: () => void;
		/** onConfirm 抛出错误时的回调，错误会继续向上抛出 */
		onError?: (error: unknown) => void;
		/** 确认按钮的样式变体 */
		confirmVariant?: ButtonVariant;
		/** 自定义触发元素，不传则需通过 open 受控打开 */
		trigger?: Snippet;
		/** 对话框标题 */
		title?: Snippet;
		/** 对话框描述内容 */
		description?: Snippet;
		/** 确认按钮文本 */
		confirmText?: string;
		/** 取消按钮文本 */
		cancelText?: string;
	};

	let {
		open = $bindable(false),
		onConfirm,
		onCancel,
		onError,
		confirmVariant = 'secondary',
		trigger,
		title,
		description,
		confirmText = '确定',
		cancelText = '取消'
	}: ConfirmDialogProps = $props();

	let isConfirming = $state(false);
	let closedByConfirm = $state(false);

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			if (!closedByConfirm) {
				onCancel?.();
			}
			closedByConfirm = false;
		}
	};

	$effect(() => {
		if (open) closedByConfirm = false;
	});

	const handleConfirm = async () => {
		isConfirming = true;
		closedByConfirm = false;
		try {
			await Promise.resolve(onConfirm());
			closedByConfirm = true;
			open = false;
		} catch (error) {
			onError?.(error);
			throw error;
		} finally {
			isConfirming = false;
		}
	};

	const actionClass = $derived(buttonVariants({ variant: confirmVariant }));
</script>

<AlertDialog.Root bind:open onOpenChange={handleOpenChange}>
	{#if trigger}
		<AlertDialog.Trigger>
			{@render trigger()}
		</AlertDialog.Trigger>
	{/if}
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
			<AlertDialog.Action
				class={actionClass}
				aria-busy={isConfirming}
				disabled={isConfirming}
				onclick={handleConfirm}
			>
				{#if isConfirming}
					<LoaderCircle class="size-4 animate-spin" />
				{/if}
				{confirmText}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
