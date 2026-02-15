<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import type { Snippet } from 'svelte';

	type ConfirmDialogProps = {
		onConfirm: () => void;
		triggerClass?: string;
		triggerText: string;
		title?: Snippet;
		description?: Snippet;
		confirmText?: string;
		cancelText?: string;
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

	let isResetDialogOpen = $state(false);

	function handleConfirm() {
		onConfirm();
	}
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
