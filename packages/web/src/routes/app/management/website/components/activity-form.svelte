<script lang="ts">
	/* eslint-disable @typescript-eslint/no-unused-vars */
	import { PlusCircle } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import ImageUpload from './image-upload.svelte';
	import VideoUpload from './video-upload.svelte';
	import LinkItem from './link-item.svelte';
	import CharCounter from './char-counter.svelte';
	import { uploadImage, uploadVideo } from '$lib/api/website';
	import type { ActivityInfo } from '$lib/types/website';

	let {
		activity = $bindable<ActivityInfo>({
			id: '',
			promotionalImage: '',
			promotionalVideo: '',
			videoLink: '',
			chineseName: '',
			englishName: '',
			description: '',
			relatedLinks: []
		})
	}: {
		activity?: ActivityInfo;
	} = $props();

	async function handlePromotionalImageUpload(file: File) {
		try {
			const url = await uploadImage(file, 'promotional');
			activity.promotionalImage = url;
		} catch (error) {
			console.error('上传宣传图失败：', error);
			// 失败时使用预览URL
			activity.promotionalImage = URL.createObjectURL(file);
		}
	}

	async function handleVideoUpload(file: File) {
		try {
			const url = await uploadVideo(file, 'promotional');
			activity.promotionalVideo = url;
		} catch (error) {
			console.error('上传视频失败：', error);
			// 失败时使用预览URL
			activity.promotionalVideo = URL.createObjectURL(file);
		}
	}

	function handleVideoLinkChange(link: string) {
		activity.videoLink = link;
	}

	function addActivityLink() {
		activity.relatedLinks = [...activity.relatedLinks, { label: '', value: '' }];
	}

	function removeActivityLink(index: number) {
		activity.relatedLinks = activity.relatedLinks.filter((_, i) => i !== index);
	}
</script>

<div class="space-y-6">
	<!-- 宣传图 -->
	<div class="space-y-2">
		<Label class="mb-0 block">
			宣传图<span class="text-red-500">*</span>
			<span class="ml-2 text-sm font-normal text-zinc-500">比例最好在 16:9 左右</span>
		</Label>
		<div class="w-[10.6875rem]">
			<ImageUpload
				aspectRatio="16:9"
				imageUrl={activity.promotionalImage}
				onUpload={handlePromotionalImageUpload}
			/>
		</div>
	</div>

	<!-- 宣传视频 / 链接 -->
	<div class="space-y-2">
		<Label class="mb-0 block">
			宣传视频/链接
			<span class="ml-2 text-xs font-normal text-zinc-500"
				>可以用部视频链接替代上传视频，但优先使用上传视频</span
			>
		</Label>

		<div class="flex items-start gap-6 pt-2">
			<Label class="mb-0 w-20 shrink-0 pt-1">上传视频</Label>
			<div>
				<VideoUpload
					videoUrl={activity.promotionalVideo}
					videoLink={activity.videoLink}
					onVideoUpload={handleVideoUpload}
					onLinkChange={handleVideoLinkChange}
				/>
			</div>
		</div>

		<div class="flex items-center gap-6">
			<Label class="mb-0 w-20 shrink-0">视频链接</Label>
			<div class="relative flex-1">
				<Input
					placeholder="填写链接"
					value={activity.videoLink ?? ''}
					maxlength={200}
					oninput={(e) => (activity.videoLink = e.currentTarget.value)}
					class="w-full pr-16"
				/>
				<div
					class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-500"
				>
					{(activity.videoLink ?? '').length}/200
				</div>
			</div>
		</div>
	</div>

	<!-- 中文名 -->
	<div class="space-y-2">
		<Label>
			中文名<span class="text-red-500">*</span>
		</Label>
		<Input
			placeholder="填写中文名"
			value={activity.chineseName}
			maxlength={200}
			oninput={(e) => (activity.chineseName = e.currentTarget.value)}
		/>
	</div>

	<!-- 英文名 -->
	<div class="space-y-2">
		<Label>英文名</Label>
		<Input
			placeholder="填写英文名"
			value={activity.englishName}
			maxlength={20}
			oninput={(e) => (activity.englishName = e.currentTarget.value)}
		/>
	</div>

	<!-- 简介 -->
	<div class="space-y-2">
		<Label>
			简介<span class="text-red-500">*</span>
		</Label>
		<div class="relative">
			<Textarea
				placeholder="填写简介"
				value={activity.description}
				maxlength={200}
				oninput={(e) => (activity.description = e.currentTarget.value)}
				class="min-h-[7.5rem] pb-16"
			/>
			<div class="absolute right-3 bottom-3">
				<CharCounter current={activity.description.length} max={200} />
			</div>
		</div>
	</div>

	<!-- 相关链接 -->
	<div class="space-y-4">
		<div class="flex items-center justify-between pb-3">
			<Label>相关链接</Label>
		</div>

		{#if activity.relatedLinks.length === 0}
			<div
				class="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700"
			>
				暂无相关链接，点击下方按钮新增
			</div>
		{:else}
			<div
				class="divide-y divide-zinc-200 rounded-lg bg-white dark:divide-zinc-800 dark:bg-zinc-900"
			>
				{#each activity.relatedLinks as _link, index (index)}
					<div class="p-4">
						<LinkItem
							bind:link={activity.relatedLinks[index]}
							onRemove={() => removeActivityLink(index)}
						/>
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex">
			<Button
				variant="block"
				onclick={addActivityLink}
				class="h-8 w-[4.75rem] justify-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 font-['Inter'] text-sm leading-5 font-medium tracking-normal text-zinc-900 hover:bg-zinc-200"
			>
				<PlusCircle class="size-4" />
				新增
			</Button>
		</div>
	</div>
</div>
