<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';

	type PartitionOption = {
		value: string;
		label: string;
	};

	let {
		partitions,
		selectedSection = $bindable(''),
		loading = false,
		error = null
	}: {
		partitions: PartitionOption[];
		selectedSection?: string;
		loading?: boolean;
		error?: string | null;
	} = $props();

	const selectedSectionLabel = $derived(
		loading
			? '加载中...'
			: selectedSection
				? (partitions.find((p) => p.value === selectedSection)?.label ?? '请选择')
				: '请选择'
	);
</script>

<!-- 需求 6.2.5.1-4：分区选择必填，与管理-分区编辑同步 -->
<Label class="mt-6 text-lg font-bold">分区选择<span class="text-red-500">*</span></Label>
<div class="mt-2">
	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{:else if !loading && partitions.length === 0}
		<p class="text-sm text-muted-foreground">
			暂无分区喵。但这怎么可能？如果你看到了这段文字，请联系开发人员。
		</p>
	{:else}
		<Select.Root type="single" name="section" bind:value={selectedSection} disabled={loading}>
			<Select.Trigger class="min-w-31.5 text-sm">
				{selectedSectionLabel}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each partitions as section (section.value)}
						<Select.Item value={section.value}>{section.label}</Select.Item>
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	{/if}
</div>
