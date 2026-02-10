<script lang="ts">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import { Plus, X, Play } from 'lucide-svelte';
	import { Label } from '$lib/components/ui/label';

	let {
		videoUrl = $bindable(''),
		videoLink = $bindable(''),
		aspectRatio = '16:9',
		label = '',
		required = false,
		onVideoUpload,
		onLinkChange
	}: {
		videoUrl?: string;
		videoLink?: string;
		aspectRatio?: string;
		label?: string;
		required?: boolean;
		onVideoUpload?: (file: File) => void;
		onLinkChange?: (link: string) => void;
	} = $props();

	let fileInput: HTMLInputElement | null = $state(null);

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (file && onVideoUpload) {
			onVideoUpload(file);
		}
	}

	function handleRemove() {
		videoUrl = '';
		if (fileInput) {
			fileInput.value = '';
		}
	}
</script>

<div>
	{#if label}
		<Label class="mb-4 block text-base leading-5 font-semibold text-[#18181B] dark:text-zinc-100">
			{label}
			{#if required}
				<span class="text-red-500">*</span>
			{/if}
			{#if aspectRatio === '16:9'}
				<span class="ml-2 text-base leading-5 font-semibold text-[#71717A]"
					>比例最好在 16:9 左右</span
				>
			{/if}
		</Label>
	{/if}

	<div class="space-y-4">
		<!-- 上传视频 -->
		<div>
			{#if videoUrl}
				<div class="relative">
					<div
						class="relative flex h-[90px] w-[160px] items-center justify-center rounded-lg bg-zinc-900"
					>
						<video src={videoUrl} class="h-full w-full rounded-lg object-cover"></video>
						<div class="bg黑/30 absolute inset-0 flex items-center justify-center rounded-lg">
							<Play class="text白 size-8" />
						</div>
						<button
							type="button"
							onclick={handleRemove}
							class="text白 hover:bg黑/70 absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/50"
						>
							<X class="size-3" />
						</button>
					</div>
				</div>
			{:else}
				<label
					class="flex h-[90px] w-[160px] cursor-pointer items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
				>
					<input
						type="file"
						accept="video/*"
						class="hidden"
						bind:this={fileInput}
						onchange={handleFileSelect}
					/>
					<div class="flex flex-col items-center gap-2">
						<Plus class="size-8 text-zinc-400" />
					</div>
				</label>
			{/if}
		</div>
	</div>
</div>
