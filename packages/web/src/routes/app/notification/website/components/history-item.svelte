<script lang="ts">
	import { X, Calendar } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ImageUpload from './image-upload.svelte';
	import CharCounter from './char-counter.svelte';
	import type { DevelopmentHistoryItem } from '$lib/types/website';

	let {
		item = $bindable<DevelopmentHistoryItem>({ image: '', date: '', description: '' }),
		onRemove
	}: {
		item?: DevelopmentHistoryItem;
		onRemove?: () => void;
	} = $props();

	function handleImageUpload(file: File) {
		// TODO: 实际上传图片，这里先用 URL.createObjectURL 预览
		item.image = URL.createObjectURL(file);
	}
</script>

<div
	class="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-4">
			<div>
				<Label class="mb-2 block">
					图片<span class="text-red-500">*</span>
				</Label>
				<ImageUpload imageUrl={item.image} aspectRatio="1:1" onUpload={handleImageUpload} />
			</div>
			<div>
				<Label class="mb-2 block">
					时间<span class="text-red-500">*</span>
				</Label>
				<div class="relative">
					<Input
						type="date"
						value={item.date}
						oninput={(e) => (item.date = e.currentTarget.value)}
						class="w-full"
					/>
					<Calendar
						class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-400"
					/>
				</div>
			</div>
			<div>
				<Label class="mb-2 block">
					描述<span class="text-red-500">*</span>
				</Label>
				<div class="flex items-center gap-2">
					<Input
						placeholder="填写描述"
						value={item.description}
						maxlength={30}
						oninput={(e) => (item.description = e.currentTarget.value)}
						class="flex-1"
					/>
					<CharCounter current={item.description.length} max={30} />
				</div>
			</div>
		</div>
		<button
			type="button"
			onclick={onRemove}
			class="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
		>
			<X class="size-4 text-zinc-500" />
		</button>
	</div>
</div>
