<script lang="ts">
	import type { V1GetFeedResponse, V1PostPreview } from '$lib/api';
	import WaterfallContainer from '$lib/components/custom/waterfall/waterfall-container/waterfall-container.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { BusinessIds, DOMAIN_CONFIG } from '$lib/constants';
	import { createDbCache } from '$lib/modules/cache';
	import {
		createFeedStore,
		createPostFetchFn,
		estimateNeedNum,
		generatePostSkeletons,
		POST_CACHE_ADAPTER,
		type FeedStore
	} from '$lib/stores/feed';
	import { cn } from '$lib/utils';
	import Download from '@lucide/svelte/icons/download';
	import { SquareArrowOutUpRight } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const hotPostCache = createDbCache<V1GetFeedResponse>(BusinessIds.HOT_POST);

	/**
	 * iOS 客户端下载落地 URL（用于二维码内容；上线后请替换为 App Store 实际上架地址）。
	 */
	const IOS_CLIENT_DOWNLOAD_URL = `https://${DOMAIN_CONFIG.app}/`;

	/**
	 * Android 客户端下载落地 URL（用于二维码内容；上线后请替换为 APK / 应用商店地址）。
	 */
	const ANDROID_CLIENT_DOWNLOAD_URL = `https://${DOMAIN_CONFIG.app}/`;

	/**
	 * 根据目标链接生成可展示的二维码图片地址（公开 QR 服务，仅作占位；可改为 `static/` 下静态图）。
	 *
	 * @param targetUrl - 扫码后打开的 URL
	 * @returns 可作为 `<img src>` 的图片 URL
	 */
	function qrImageUrlFor(targetUrl: string): string {
		const params = new URLSearchParams({
			size: '176x176',
			margin: '8',
			data: targetUrl
		});
		return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
	}

	let waterfallRef: ReturnType<typeof WaterfallContainer> | null = $state(null);
	let containerEl: HTMLElement | null = $state(null);

	let store = $state<FeedStore<V1PostPreview> | null>(null);

	/** 控制「下载客户端」说明弹层 */
	let downloadDialogOpen = $state(false);

	let isGoToAppActive = $state(false);
	let isDownloadClientActive = $state(false);

	onMount(() => {
		store = createFeedStore<V1PostPreview>('general', {
			needNum: estimateNeedNum('waterfall', {
				containerWidth: containerEl?.clientWidth ?? 0,
				containerHeight: containerEl?.clientHeight ?? 0,
				gap: waterfallRef?.resolveGapPx() ?? 8,
				minItemWidth: waterfallRef?.DEFAULT_CONFIG.minCardWidth ?? 280
			}),
			cache: hotPostCache,
			cacheAdapter: POST_CACHE_ADAPTER,
			getItemId: (post) => post.postId,
			generateSkeleton: generatePostSkeletons,
			fetchFn: createPostFetchFn(() => ({})),
			onError: () => {
				toast.error('Feed 内容获取失败，请检查您的网络连接');
			}
		});
		store.init();
		store.refresh();
	});
</script>

<!--
	热门动态：锚点 #post
	高度：100dvh − 顶栏 h-20(5rem)。pt-46 在 border-box 下已计入总高，勿在 calc 里再减 11.5rem，否则内容区会再少一截。
-->
<section id="post" class="w-full" aria-label="热门动态">
	<div class="flex h-[calc(100dvh-5rem)] w-full flex-col px-50 pt-10" aria-label="热门动态内容区">
		<!--
			顶栏：左侧标题 + 右侧下载入口；与下方瀑布流装饰框分离，避免挤占滚动区域语义。
		-->
		<div class="mb-5 flex shrink-0 flex-wrap items-center justify-between gap-4">
			<h2
				class="font-tech text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-100"
			>
				晒你 App 热门动态
			</h2>
			<div class="flex items-center gap-0 *:h-8 *:w-36 *:rounded-none">
				<Button
					onpointerenter={() => (isGoToAppActive = true)}
					onpointerleave={() => (isGoToAppActive = false)}
					onpointerdown={() => (isGoToAppActive = true)}
					variant={isGoToAppActive ? 'default' : 'ghost'}
					href={`https://${DOMAIN_CONFIG.app}`}
					target="_blank"
					class={cn('text-zinc-500 ', isGoToAppActive && 'bg-red-500! text-white')}
					>进入 App
					<SquareArrowOutUpRight
						class="post-enter-app-icon size-4 shrink-0"
						strokeWidth={2}
					/></Button
				>
				<Button
					onpointerenter={() => (isDownloadClientActive = true)}
					onpointerleave={() => (isDownloadClientActive = false)}
					onpointerdown={() => (isDownloadClientActive = true)}
					onclick={() => (downloadDialogOpen = true)}
					variant={isDownloadClientActive ? 'default' : 'ghost'}
					class={cn('text-zinc-500 ', isDownloadClientActive && 'bg-red-500! text-white')}
					>下载客户端
					<Download class="post-download-icon-wrap size-4 shrink-0" strokeWidth={2} />
				</Button>
			</div>
		</div>

		<!--
			外围装饰：圆角边框 + 浅底，包住瀑布流视口。
		-->
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div class="h-full min-h-0 w-full overflow-hidden" bind:this={containerEl}>
				{#if store}
					<WaterfallContainer
						bind:this={waterfallRef}
						posts={store.items}
						loading={store.loadingMore}
						hasMore={store.hasMore}
						showSkeleton={store.showSkeleton}
						refreshing={store.refreshing}
						businessId={BusinessIds.HOT_POST}
						categoryId={BusinessIds.HOT_POST}
						onLoadMore={store.loadMore}
						onRefresh={store.refresh}
					/>
				{/if}
			</div>
		</div>
	</div>
</section>

<Dialog.Root bind:open={downloadDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>下载客户端</Dialog.Title>
			<Dialog.Description>使用手机扫描下方二维码，下载晒你 App。</Dialog.Description>
		</Dialog.Header>
		<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6">
			<div class="flex flex-col items-center gap-3">
				<p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">iOS 客户端</p>
				<img
					src={qrImageUrlFor(IOS_CLIENT_DOWNLOAD_URL)}
					width="176"
					height="176"
					alt="iOS 客户端下载二维码"
					class="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-600"
					loading="lazy"
					decoding="async"
				/>
			</div>
			<div class="flex flex-col items-center gap-3">
				<p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Android 客户端</p>
				<img
					src={qrImageUrlFor(ANDROID_CLIENT_DOWNLOAD_URL)}
					width="176"
					height="176"
					alt="Android 客户端下载二维码"
					class="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-600"
					loading="lazy"
					decoding="async"
				/>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	/**
	 * 「进入 App」外链图标：原地缩放弹跳（translate 保持 0，避免与 transform 冲突）。
	 */
	@keyframes post-enter-app-bounce {
		0%,
		100% {
			transform: scale(1);
		}
		40% {
			transform: scale(1.18);
		}
		70% {
			transform: scale(0.94);
		}
	}

	/**
	 * 「下载客户端」图标：循环微下移，模拟「向下获取」。
	 */
	@keyframes post-download-dip {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(4px);
		}
	}

	/**
	 * 父级 Button/Link 接收 hover；子 SVG 被 [&_svg]:pointer-events-none，无法自身 :hover。
	 */
	:global([data-slot='button']:hover .post-enter-app-icon) {
		animation: post-enter-app-bounce 1s ease-in-out infinite;
		transform-origin: center;
	}

	:global([data-slot='button']:hover .post-download-icon-wrap) {
		animation: post-download-dip 1s ease-in-out infinite;
	}
</style>
