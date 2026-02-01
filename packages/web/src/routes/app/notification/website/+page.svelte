<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import VideoUpload from './components/video-upload.svelte';
	import LinkItem from './components/link-item.svelte';
	import CharCounter from './components/char-counter.svelte';
	import type { Link } from '$lib/types/website';

	// 表单数据
	let homepageVideo = $state('');
	let homepageVideoLink = $state('');
	let aboutShining = $state('');
	let relatedLinks = $state<Link[]>([]);

	// 最后保存时间
	let lastSaved = $state<string | null>(null);

	function handleVideoUpload(file: File) {
		// TODO: 实际上传视频，这里先用 URL.createObjectURL 预览
		homepageVideo = URL.createObjectURL(file);
	}

	function handleVideoLinkChange(link: string) {
		homepageVideoLink = link;
	}

	function addLink() {
		relatedLinks = [...relatedLinks, { label: '', value: '' }];
	}

	function removeLink(index: number) {
		relatedLinks = relatedLinks.filter((_, i) => i !== index);
	}

	function handleReset() {
		homepageVideo = '';
		homepageVideoLink = '';
		aboutShining = '';
		relatedLinks = [];
		lastSaved = null;
	}

	function handleSave() {
		// TODO: 实现保存逻辑
		const now = new Date();
		lastSaved = `${now.getHours().toString().padStart(2, '0')}:${now
			.getMinutes()
			.toString()
			.padStart(2, '0')}`;
		console.log('保存数据:', {
			homepageVideo,
			homepageVideoLink,
			aboutShining,
			relatedLinks
		});
	}

	function handlePublish() {
		// TODO: 实现发布逻辑
		handleSave();
		console.log('发布变更');
	}
</script>

<div class="space-y-8 p-6">
	<!-- 首页视频 -->
	<div class="space-y-4">
		<VideoUpload
			label="首页视频"
			required
			aspectRatio="16:9"
			videoUrl={homepageVideo}
			videoLink={homepageVideoLink}
			onVideoUpload={handleVideoUpload}
			onLinkChange={handleVideoLinkChange}
		/>
	</div>

	<!-- 了解我们 -->
	<div class="space-y-6">
		<h2 class="text-xl font-bold">了解我们</h2>

		<!-- 关于晒你 -->
		<div class="space-y-2">
			<Label>
				关于晒你<span class="text-red-500">*</span>
			</Label>
			<div class="relative">
				<Textarea
					placeholder="填写晒你故事"
					value={aboutShining}
					maxlength={300}
					oninput={(e) => (aboutShining = e.currentTarget.value)}
					class="min-h-[120px] pr-16"
				/>
				<div class="absolute right-3 bottom-3">
					<CharCounter current={aboutShining.length} max={300} />
				</div>
			</div>
		</div>

		<!-- 相关链接 -->
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<Label>相关链接</Label>
				<Button variant="ghost" size="sm" onclick={addLink}>
					<Plus class="size-4" />
					添加链接
				</Button>
			</div>
			{#if relatedLinks.length === 0}
				<div
					class="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700"
				>
					暂无相关链接，点击上方按钮添加
				</div>
			{:else}
				<div class="space-y-4">
					{#each relatedLinks as link, index (index)}
						<LinkItem {link} onRemove={() => removeLink(index)} />
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- 底部操作栏 -->
	<div class="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
		<div class="flex gap-4">
			<Button variant="tertiary" onclick={handleReset}>重置</Button>
			<Button variant="tertiary" onclick={handleSave}>保存</Button>
			<Button variant="default" onclick={handlePublish}>发布变更</Button>
		</div>
		{#if lastSaved}
			<p class="text-sm text-zinc-500">保存于 {lastSaved}</p>
		{/if}
	</div>
</div>
