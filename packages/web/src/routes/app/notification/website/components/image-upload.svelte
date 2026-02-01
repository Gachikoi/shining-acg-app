<script lang="ts">
	import { Plus, X } from 'lucide-svelte';
	import { Label } from '$lib/components/ui/label';

	let {
		imageUrl = $bindable(''),
		aspectRatio = '16:9',
		label = '',
		required = false,
		onUpload
	}: {
		imageUrl?: string;
		aspectRatio?: string;
		label?: string;
		required?: boolean;
		onUpload?: (file: File) => void;
	} = $props();

	let fileInput: HTMLInputElement | null = $state(null);

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && onUpload) {
			onUpload(file);
		}
	}

	function handleRemove() {
		imageUrl = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}

	let aspectClass = $derived(
		aspectRatio === '1:1' ? 'aspect-square' : aspectRatio === '16:9' ? 'aspect-video' : ''
	);
</script>

<div class="space-y-2">
	{#if label}
		<Label>
			{label}
			{#if required}
				<span class="text-red-500">*</span>
			{/if}
			{#if aspectRatio === '16:9'}
				<span class="ml-2 text-sm font-normal text-zinc-500">比例最好在 16:9 左右</span>
			{:else if aspectRatio === '1:1'}
				<span class="ml-2 text-sm font-normal text-zinc-500">1:1</span>
			{/if}
		</Label>
	{/if}

	<div class="relative">
		{#if imageUrl}
			<div class="relative">
				<img src={imageUrl} alt="Uploaded" class="w-full rounded-lg object-cover {aspectClass}" />
				<button
					type="button"
					onclick={handleRemove}
					class="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
				>
					<X class="size-4" />
				</button>
			</div>
		{:else}
			<label
				class="flex {aspectClass} w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
			>
				<input
					type="file"
					accept="image/*"
					class="hidden"
					bind:this={fileInput}
					onchange={handleFileSelect}
				/>
				<div class="flex flex-col items-center gap-2">
					<Plus class="size-12 text-zinc-400" />
				</div>
			</label>
		{/if}
	</div>
</div>

<script lang="ts">
	import { Plus, X } from 'lucide-svelte';
	import { Label } from '$lib/components/ui/label';

	let {
		imageUrl = $bindable(''),
		aspectRatio = '16:9',
		label = '',
		required = false,
		onUpload
	}: {
		imageUrl?: string;
		aspectRatio?: string;
		label?: string;
		required?: boolean;
		onUpload?: (file: File) => void;
	} = $props();

	let fileInput: HTMLInputElement | null = $state(null);

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && onUpload) {
			onUpload(file);
		}
	}

	function handleRemove() {
		imageUrl = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}

	let aspectClass = $derived(
		aspectRatio === '1:1' ? 'aspect-square' : aspectRatio === '16:9' ? 'aspect-video' : ''
	);
</script>

<div class="space-y-2">
	{#if label}
		<Label>
			{label}
			{#if required}
				<span class="text-red-500">*</span>
			{/if}
			{#if aspectRatio === '16:9'}
				<span class="ml-2 text-sm font-normal text-zinc-500">比例最好在 16:9 左右</span>
			{:else if aspectRatio === '1:1'}
				<span class="ml-2 text-sm font-normal text-zinc-500">1:1</span>
			{/if}
		</Label>
	{/if}

	<div class="relative">
		{#if imageUrl}
			<div class="relative">
				<img src={imageUrl} alt="Uploaded" class="w-full rounded-lg object-cover {aspectClass}" />
				<button
					type="button"
					onclick={handleRemove}
					class="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
				>
					<X class="size-4" />
				</button>
			</div>
		{:else}
			<label
				class="flex {aspectClass} w-full cursor-pointer items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
			>
				<input
					type="file"
					accept="image/*"
					class="hidden"
					bind:this={fileInput}
					onchange={handleFileSelect}
				/>
				<div class="flex flex-col items-center gap-2">
					<Plus class="size-12 text-zinc-400" />
				</div>
			</label>
		{/if}
	</div>
</div>
