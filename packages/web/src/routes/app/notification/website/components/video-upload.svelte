<script lang="ts">
	import { Plus, X, Play } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
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

	function handleLinkInput(value: string) {
		videoLink = value;
		if (onLinkChange) {
			onLinkChange(value);
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
		<p class="text-sm text-zinc-600 dark:text-zinc-400">
			可以用外部视频链接替代上传视频,但优先使用上传视频
		</p>

		<!-- 上传视频 -->
		<div>
			<p class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">上传视频</p>
			{#if videoUrl}
				<div class="relative">
					<div
						class="relative flex h-[90px] w-[160px] items-center justify-center rounded-lg bg-zinc-900"
					>
						<video src={videoUrl} class="h-full w-full rounded-lg object-cover"></video>
						<div class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
							<Play class="size-8 text-white" />
						</div>
						<button
							type="button"
							onclick={handleRemove}
							class="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
						>
							<X class="size-3" />
						</button>
					</div>
				</div>
			{:else}
				<label
					class="flex h-[90px] w-[160px] cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800"
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

		<!-- 视频链接 -->
		<div>
			<p class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">视频链接</p>
			<Input
				placeholder="填写链接"
				value={videoLink}
				oninput={(e) => handleLinkInput(e.currentTarget.value)}
			/>
		</div>
	</div>
</div>
