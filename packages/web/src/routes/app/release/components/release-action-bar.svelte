<script lang="ts">
	import { ConfirmDialog } from '$lib/components/custom/confirm-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import { formatTimeAccuracyFirst } from '$lib/utils/format-time';
	import { TOAST_MESSAGES } from '$lib/constants/toast-messages';

	type UploadProgress = {
		uploadedFiles: number;
		totalFiles: number;
		percent?: number;
	};

	let {
		isUploading,
		uploadProgress,
		hasUploadError = false,
		lastSaved,
		lastSavedIsAutoSave,
		showLeaveConfirm = $bindable(false),
		showPublishConfirm = $bindable(false),
		onReset,
		onSave,
		onPublishClick,
		onLeaveConfirm,
		onLeaveCancel,
		onSubmit,
		onCancelUpload,
		onRetryUpload,
		onRemoveFailedAndProceed
	}: {
		isUploading: boolean;
		uploadProgress: UploadProgress;
		/** 存在上传失败文件时展示重试/删除失败项按钮 */
		hasUploadError?: boolean;
		lastSaved: string | null;
		lastSavedIsAutoSave: boolean;
		showLeaveConfirm?: boolean;
		showPublishConfirm?: boolean;
		onReset: () => void;
		onSave: () => void;
		onPublishClick: () => void;
		onLeaveConfirm: () => void | Promise<void>;
		onLeaveCancel: () => void;
		onSubmit: () => void | Promise<void>;
		onCancelUpload: () => void;
		/** 断线/失败后重试上传 */
		onRetryUpload?: () => void | Promise<void>;
		/** 删除失败项，仅用已成功文件继续发布 */
		onRemoveFailedAndProceed?: () => void | Promise<void>;
	} = $props();
</script>

<!-- 底部按钮：需求 6.2.5.2 操作区 -->
<!-- 保存：无变更时 toast、有变更持久化、1min 自动保存、显示「保存于/自动保存于 xx:xx」 -->
<div class="flex gap-2 border-t border-zinc-100 p-4 font-medium">
	<ConfirmDialog onConfirm={onReset} confirmText="重置">
		{#snippet trigger()}
			<Button variant="tertiary" class="cursor-pointer text-muted-foreground" disabled={isUploading}
				>重置</Button
			>
		{/snippet}
		{#snippet description()}
			<p>
				确定要重置吗？
				<br />
				编辑的内容将会丢失
			</p>
		{/snippet}
	</ConfirmDialog>

	<ConfirmDialog
		bind:open={showLeaveConfirm}
		onConfirm={onLeaveConfirm}
		onCancel={onLeaveCancel}
		confirmText="退出"
	>
		{#snippet description()}
			<p>确认退出编辑吗？</p>
		{/snippet}
	</ConfirmDialog>

	<ConfirmDialog bind:open={showPublishConfirm} onConfirm={onSubmit} confirmText="发布">
		{#snippet description()}
			<p>确定要发布帖子吗？</p>
		{/snippet}
	</ConfirmDialog>

	<Button
		variant="tertiary"
		class="cursor-pointer text-muted-foreground"
		onclick={onSave}
		disabled={isUploading}>保存</Button
	>

	{#if isUploading}
		<!-- 上传中：显示进度 + 取消按钮；失败时额外展示重试/删除失败项 -->
		<!-- TODO(6.2.5.4-1): 完整实现需求中的 App 横幅通知进度条（等横幅通知组件就绪后替换） -->
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			<div class="flex flex-wrap items-center gap-3">
				<span class="text-sm text-muted-foreground">
					{hasUploadError
						? '部分文件上传失败'
						: `上传中 ${uploadProgress.uploadedFiles}/${uploadProgress.totalFiles}…`}
				</span>
				{#if hasUploadError && onRetryUpload && onRemoveFailedAndProceed}
					<!-- 失败时：重试 / 删除失败项并继续（二次确认） -->
					<Button variant="tertiary" class="cursor-pointer" onclick={onRetryUpload}>重试</Button>
					<ConfirmDialog onConfirm={onRemoveFailedAndProceed} confirmText="删除失败项并继续">
						{#snippet trigger()}
							<Button variant="tertiary" class="cursor-pointer">删除失败项并继续</Button>
						{/snippet}
						{#snippet description()}
							<p>{TOAST_MESSAGES.REMOVE_FAILED_CONFIRM}</p>
						{/snippet}
					</ConfirmDialog>
				{/if}
				<ConfirmDialog onConfirm={onCancelUpload} confirmText="取消上传">
					{#snippet trigger()}
						<Button variant="tertiary" class="cursor-pointer text-destructive">取消</Button>
					{/snippet}
					{#snippet description()}
						<p>确定要取消上传吗？已上传的内容将被清理。</p>
					{/snippet}
				</ConfirmDialog>
			</div>
			{#if !hasUploadError}
				<Progress value={uploadProgress.percent ?? 0} class="h-1.5 min-w-0 flex-1" />
			{/if}
		</div>
	{:else}
		<Button
			variant="default"
			class="flex-1 cursor-pointer transition-none lg:flex-none"
			onclick={onPublishClick}>发布帖子</Button
		>
	{/if}

	{#if lastSaved && !isUploading}
		<div class="mx-4 flex items-center text-sm text-muted-foreground">
			{lastSavedIsAutoSave ? '自动保存于 ' : '保存于 '}
			{formatTimeAccuracyFirst(lastSaved)}
		</div>
	{/if}
</div>
