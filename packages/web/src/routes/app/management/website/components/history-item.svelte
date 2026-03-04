<script lang="ts">
	import { CharCounter } from '$lib/components/custom/char-counter';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import type { DevelopmentHistoryItem } from '$lib/types/website';
	import { Minus } from 'lucide-svelte';
	import ImageUpload from './image-upload.svelte';

	let {
		item = $bindable<DevelopmentHistoryItem>({ image: '', date: '', description: '' }),
		canRemove = true,
		onRemove
	}: {
		item?: DevelopmentHistoryItem;
		canRemove?: boolean;
		onRemove?: () => void;
	} = $props();

	async function handleImageUpload(file: File) {
		try {
			// const url = await uploadImage(file, 'history');
			// item.image = url;
		} catch (error) {
			console.error('上传图片失败：', error);
			// 失败时使用预览URL
			item.image = URL.createObjectURL(file);
		}
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<div class="flex-1 space-y-4">
			<div class="flex items-start gap-6">
				<Label class="mb-0 w-20 shrink-0 pt-2 text-sm font-medium text-zinc-900">
					图片<span class="text-red-500">*</span>
				</Label>
				<div class="w-[7rem]">
					<ImageUpload imageUrl={item.image} aspectRatio="1:1" onUpload={handleImageUpload} />
				</div>
			</div>

			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
				<Label
					class="mb-0 text-sm font-medium text-zinc-900 sm:w-20 sm:shrink-0 sm:text-left sm:[line-height:1.25rem]"
				>
					时间<span class="text-red-500">*</span>
				</Label>
				<div class="w-full sm:w-[18.75rem]">
					<DatePicker bind:value={item.date} />
				</div>
			</div>

			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
				<Label
					class="mb-0 text-sm font-medium text-zinc-900 sm:w-20 sm:shrink-0 sm:text-left sm:[line-height:1.25rem]"
				>
					描述<span class="text-red-500">*</span>
				</Label>
				<div class="relative w-full sm:flex-1">
					<Input
						placeholder="填写描述"
						value={item.description}
						maxlength={30}
						oninput={(e) => (item.description = e.currentTarget.value)}
						class="w-full pr-16"
					/>
					<div class="absolute top-1/2 right-3 -translate-y-1/2">
						<CharCounter current={item.description.length} max={30} />
					</div>
				</div>
			</div>
		</div>

		<button
			type="button"
			onclick={() => {
				if (!canRemove) return;
				onRemove?.();
			}}
			disabled={!canRemove}
			class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-800"
		>
			<Minus class="h-4 w-6 text-white" />
		</button>
	</div>
</div>
