<script lang="ts">
	export let aspectRatio: number;
</script>

<article class="bg-transparent">
	<figure class="relative overflow-hidden rounded-lg">
		<div class="skeleton-bg relative w-full overflow-hidden" style="aspect-ratio: {aspectRatio};">
			<div
				class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
			></div>
		</div>
	</figure>

	<footer class="mt-2 px-1">
		<div class="skeleton-bg relative h-4 w-[90%] overflow-hidden rounded-md">
			<div
				class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
			></div>
		</div>

		<div class="skeleton-bg relative mt-2 h-3 w-[70%] overflow-hidden rounded-md">
			<div
				class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
			></div>
		</div>

		<div class="mt-2 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<div class="skeleton-bg relative h-5 w-5 overflow-hidden rounded-full">
					<div
						class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
					></div>
				</div>
				<div class="skeleton-bg relative h-3 w-[60px] overflow-hidden rounded-md">
					<div
						class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
					></div>
				</div>
			</div>
			<div class="skeleton-bg relative h-3 w-[50px] overflow-hidden rounded-md">
				<div
					class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
				></div>
			</div>
		</div>

		<div class="mt-2 flex items-center gap-3">
			<div class="skeleton-bg relative h-3 w-[30px] overflow-hidden rounded-md">
				<div
					class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
				></div>
			</div>
			<div class="skeleton-bg relative h-3 w-[30px] overflow-hidden rounded-md">
				<div
					class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
				></div>
			</div>
			<div class="skeleton-bg relative h-3 w-[30px] overflow-hidden rounded-md">
				<div
					class="shimmer-effect absolute top-0 -left-full h-full w-full bg-linear-to-r from-transparent via-white/40 to-transparent"
				></div>
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
</style>
