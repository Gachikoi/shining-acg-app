<script lang="ts">
	import { Minus } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import ImageUpload from './image-upload.svelte';
	import CharCounter from './char-counter.svelte';
	import { uploadImage } from '$lib/api/website';
	import type { DevelopmentHistoryItem } from '$lib/types/website';

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
			const url = await uploadImage(file, 'history');
			item.image = url;
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
				<div class="w-[112px]">
					<ImageUpload imageUrl={item.image} aspectRatio="1:1" onUpload={handleImageUpload} />
				</div>
			</div>

			<div class="flex items-center gap-6">
				<Label class="mb-0 w-20 shrink-0 text-sm font-medium text-zinc-900">
					时间<span class="text-red-500">*</span>
				</Label>
				<div class="w-[300px]">
					<DatePicker bind:value={item.date} />
				</div>
			</div>

			<div class="flex items-center gap-6">
				<Label class="mb-0 w-20 shrink-0 text-sm font-medium text-zinc-900">
					描述<span class="text-red-500">*</span>
				</Label>
				<div class="flex flex-1 items-center gap-4">
					<Input
						placeholder="填写描述"
						value={item.description}
						maxlength={30}
						oninput={(e) => (item.description = e.currentTarget.value)}
						class="w-full"
					/>
					<div class="shrink-0 text-right">
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
