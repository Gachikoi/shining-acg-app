<script module lang="ts">
	// 常量定义
	import { linear } from 'svelte/easing';

	const exampleImageDataURLs: string[] = ['/src/lib/assets/rectangle-logo.png'];

	// 封面比例
	const CoverRatioArray = ['1:1', '4:3', '3:4'] as const;
	// 封面比例类型
	type CoverRatio = (typeof CoverRatioArray)[number];
	// 封面比例对应的宽高
	const coverRatioToAspectRatio: Record<CoverRatio, string> = {
		'1:1': 'w-39 h-39',
		'4:3': 'w-52 h-39',
		'3:4': 'w-39 h-52'
	} as const;
	const defaultCoverRatio: CoverRatio = '3:4';

	const titleWordLimit = 20; // 标题字数限制

	// 出现然后淡出，用于封面比例标签提示
	const appearThenFade = (_: Element, { delay = 500, duration = 400, easing = linear } = {}) => {
		return {
			delay,
			duration,
			easing,
			css: (t: number) => `opacity: ${1 - t};`
		};
	};
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { cn } from '$lib/utils';
	import { PlusIcon } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { ConfirmDialog } from '$lib/components/custom/confirm-dialog';
	import ShinRichTextarea from '$lib/components/custom/shin-rich/shin-rich-textarea.svelte';

	let lastSaved = $state('11:33');
	// 考虑将 exampleImageDataURLs 改为从 IndexedDB 中获取图片
	let cachedImagesDataURLs = $state<string[]>([...exampleImageDataURLs]);

	let selectedImageURL = $state<string | null>(null);

	let coverRatio = $state<CoverRatio>(defaultCoverRatio);

	let titleContent = $state('');

	function handleReset() {
		titleContent = '';
		coverRatio = defaultCoverRatio;
		cachedImagesDataURLs = [];
		selectedImageURL = null;
	}

	// 封面比例轮换
	function rotateCoverRatio() {
		const currentIndex = CoverRatioArray.indexOf(coverRatio);
		const nextIndex = (currentIndex + 1) % CoverRatioArray.length;
		coverRatio = CoverRatioArray[nextIndex];
	}

	// 如果未选择封面，则使用第一张图片作为封面
	$effect(() => {
		if (selectedImageURL === null && cachedImagesDataURLs.length > 0) {
			selectedImageURL = cachedImagesDataURLs[0];
		}
	});
</script>

<main
	class="flex h-full flex-col rounded-2xl border-zinc-100 lg:mx-4 lg:h-[calc(100%-1rem)] lg:border"
>
	<div class="min-h-0 grow overflow-y-auto p-6">
		<!-- 封面设置文字 -->
		<p class="text-lg font-bold">
			封面设置
			<br class="lg:hidden" />
			<span class="text-sm font-normal text-muted-foreground">
				未设置封面时，以第 1
				张图片或视频首帧作为封面；若没有图片或视频，将会使用正文内容自动生成封面。
			</span>
		</p>
		<!-- 封面预览 -->
		<button
			class={cn(
				'relative mt-4 flex cursor-pointer items-center justify-center rounded-xl bg-muted transition-all',
				coverRatioToAspectRatio[coverRatio]
			)}
			onclick={rotateCoverRatio}
		>
			{#if selectedImageURL}
				<img
					src={selectedImageURL}
					alt="封面"
					class="h-full w-full cursor-pointer object-cover"
					draggable="false"
				/>
				<!-- 目前实现了封面比例切换，但未真正实现裁剪功能 -->
				<!-- TODO: 点击封面预览图片，可以进行编辑 -->
				<!-- TODO: 用户选择封面后强制弹出图片视频预览编辑器裁切；未设置时自动兜底逻辑 -->
			{:else}
				<span class="text-xs text-muted-foreground">比例1:1 / 4:3 / 3:4</span>
			{/if}
			<!-- 封面比例标签提示，当封面比例改变时，标签提示出现，经过小段时间后标签自动淡出 -->
			{#key coverRatio}
				<div
					class="pointer-events-none absolute top-5/6 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-zinc-900/60 px-2 py-1 text-xs text-zinc-100 opacity-0"
					in:appearThenFade
				>
					{coverRatio}
				</div>
			{/key}
		</button>
		<!-- 选择封面 -->
		<!-- TODO: 实现选择图片/视频 -->
		<!-- TODO: 实现删除图片/视频 -->
		<Label class="mt-6 text-lg font-bold">选择图片/视频</Label>
		<div class="mt-4 flex gap-2">
			{#each cachedImagesDataURLs as imageDataURL, index (index)}
				<div class="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl bg-muted">
					<img src={imageDataURL} alt="封面" class="h-full w-full object-cover" />
				</div>
			{/each}
			<div
				class="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl bg-muted hover:bg-muted-foreground/10"
			>
				<PlusIcon class="size-4 text-muted-foreground" />
			</div>
		</div>
		<!-- TODO: 实现正文内容编辑，依赖于富文本编辑器组件 -->
		<p class="mt-6 text-lg font-bold">正文内容</p>
		<div class="relative mt-2">
			<Input
				bind:value={titleContent}
				maxlength={titleWordLimit}
				placeholder="填写标题"
				class="pr-16"
			></Input>
			<div
				class="pointer-events-none absolute right-3 bottom-1/2 translate-y-1/2 text-muted-foreground"
			>
				{titleContent.length}/{titleWordLimit}
			</div>
		</div>
		<ShinRichTextarea placeholder="添加帖子描述" class="mt-5" />
	</div>
	<!-- 底部按钮 -->
	<!-- TODO: 实现重置按钮功能，需要弹窗让用户二次确认 -->
	<!-- TODO: 实现保存按钮功能 -->
	<div class="flex gap-2 border-t border-zinc-100 p-4 font-medium">
		<ConfirmDialog onConfirm={handleReset} confirmText="重置">
			{#snippet trigger()}
				<Button variant="tertiary" class="cursor-pointer text-muted-foreground">重置</Button>
			{/snippet}
			{#snippet description()}
				<p>
					确定要重置吗？
					<br />
					编辑的内容将会丢失
				</p>
			{/snippet}
		</ConfirmDialog>
		<Button variant="tertiary" class="cursor-pointer text-muted-foreground">保存</Button>
		<Button variant="default" class="flex-1 cursor-pointer transition-none lg:flex-none"
			>发布帖子</Button
		>
		<div class="mx-4 hidden items-center text-sm text-muted-foreground lg:flex">
			自动保存于 {lastSaved}
		</div>
	</div>
</main>
