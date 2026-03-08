<script lang="ts">
	let {
		aspectRatio,
		style = '',
		isShowTime = false
	}: { aspectRatio?: number; style?: string; isShowTime?: boolean } = $props();

	let ratioStyle = $derived.by(() => {
		if (!aspectRatio) {
			return 'height: 100%;';
		}
		return `aspect-ratio: ${aspectRatio};`;
	});
</script>

<article class="rounded-xl border border-border" {style}>
	<!-- 封面区域：与 waterfall-card figure 对齐 -->
	<figure class="relative overflow-hidden rounded-t-xl bg-zinc-100 dark:bg-zinc-900">
		<div class="skeleton-bg relative w-full overflow-hidden" style={ratioStyle}>
			<div
				class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
			></div>
		</div>
	</figure>

	<!-- footer：与 waterfall-card footer p-3 对齐 -->
	<footer class="p-3">
		<!-- 标题：单行骨架 -->
		<div class="skeleton-bg relative h-3.5 w-[90%] overflow-hidden rounded-md">
			<div
				class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
			></div>
		</div>

		<!-- 作者行：左侧头像 + 名字/时间，右侧心形 + 点赞数 -->
		<div class="mt-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<!-- 头像 size-5 rounded-full -->
				<div class="skeleton-bg relative h-5 w-5 shrink-0 overflow-hidden rounded-full">
					<div
						class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
					></div>
				</div>
				<!-- 名字 + 可选时间 -->
				<div class="flex flex-col gap-0.5">
					<div class="skeleton-bg relative h-3 w-16 overflow-hidden rounded-md">
						<div
							class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
						></div>
					</div>
					{#if isShowTime}
						<div class="skeleton-bg relative h-3 w-12 overflow-hidden rounded-md">
							<div
								class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
							></div>
						</div>
					{/if}
				</div>
			</div>
			<!-- 心形图标 + 点赞数 -->
			<div class="flex items-center gap-0.75">
				<div class="skeleton-bg relative h-4 w-4 overflow-hidden rounded-sm">
					<div
						class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
					></div>
				</div>
				<div class="skeleton-bg relative h-3 w-6 overflow-hidden rounded-md">
					<div
						class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
					></div>
				</div>
			</div>
		</div>
	</footer>
</article>

<style>
	@keyframes shimmer {
		0% {
			left: -100%;
		}
		100% {
			left: 100%;
		}
	}
	.shimmer-effect {
		animation: shimmer 2s infinite;
	}
	.skeleton-bg {
		background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
		background-size: 200% 100%;
	}

	:global(.dark) .shimmer-effect {
		background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.06), transparent);
	}

	:global(.dark) .skeleton-bg {
		background: linear-gradient(
			90deg,
			oklch(0.37 0.01 286),
			oklch(0.14 0 286),
			oklch(0.37 0.01 286)
		);
		background-size: 200% 100%;
	}
</style>
