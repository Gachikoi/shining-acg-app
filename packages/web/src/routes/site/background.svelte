<script lang="ts">
	import { page } from '$app/state';
	import { Mouse } from 'lucide-svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import { NAV_ITEMS } from './constants';

	/**
	 * 将 enDescription 拆成竖排多行（| 分隔）。
	 * @param raw - constants 中的 enDescription
	 * @returns 去空后的行数组
	 */
	function splitDescription(raw: string): string[] {
		return raw
			.split('|')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	/** 无 hash 时与导航一致，视为首页 */
	const hashKey = $derived(page.url.hash.length > 0 ? page.url.hash : NAV_ITEMS[0].hash);

	const nav = $derived(NAV_ITEMS.find((n) => n.hash === hashKey) ?? NAV_ITEMS[0]);

	const descriptionLines = $derived(splitDescription(nav.enDescription));

	/**
	 * 左侧旋转标语：词之间用多个 NBSP 分隔，避免在竖排时被拆开。
	 */
	const leftBannerLabel = ['SHINING', 'ACG', 'FAN', 'CLUB'].join('\u00A0'.repeat(4));
</script>

<div class="fixed inset-0 z-0 bg-zinc-50">
	<!--
		背景网格：zinc 负责全长格线；red 仅在与顶点对齐的每向 4px 短线（横、竖各一层 + mask），与格线同受 mask 渐隐
	-->
	<div class="grid-lines relative h-full w-full *:absolute *:inset-0">
		<div class="grid-lines-zinc" aria-hidden="true"></div>
		<div class="grid-lines-red-h" aria-hidden="true"></div>
		<div class="grid-lines-red-v" aria-hidden="true"></div>
	</div>

	<!--
		左侧装饰：渐变点阵
	-->
	<div
		class="absolute top-1/2 left-0 z-0 h-[600px] w-[300px] -translate-y-1/2 [--dot-matrix-w:300px]"
		aria-hidden="true"
	>
		<div class="dot-matrix-left absolute inset-0 z-0 flex">
			<div class="dot-matrix-band dot-matrix-band-1 h-full min-w-0 flex-1"></div>
			<div class="dot-matrix-band dot-matrix-band-2 h-full min-w-0 flex-1"></div>
			<div class="dot-matrix-band dot-matrix-band-3 h-full min-w-0 flex-1"></div>
			<div class="dot-matrix-band dot-matrix-band-4 h-full min-w-0 flex-1"></div>
			<div class="dot-matrix-band dot-matrix-band-5 h-full min-w-0 flex-1"></div>
			<div class="dot-matrix-band dot-matrix-band-6 h-full min-w-0 flex-1"></div>
		</div>
	</div>

	<!-- 左侧装饰：红条 + 竖排标语 -->
	<div class="absolute bottom-120 -left-26 z-0 flex h-4 w-96 rotate-90 items-center gap-16">
		<div class="h-6 w-[340px] shrink-0 bg-red-500"></div>
		<span class="font-sans leading-none font-bold tracking-tight text-zinc-800 uppercase">
			{leftBannerLabel}
		</span>
	</div>

	<!--
		右侧装饰：点阵+英文标语
	-->
	{#key hashKey}
		<div
			class="dot-matrix absolute top-58 -right-40 h-[140px] w-[460px] rotate-90"
			aria-hidden="true"
			in:fly={{ y: -200, duration: 500, delay: 600, easing: cubicOut }}
			out:fly={{ y: -200, duration: 500, easing: cubicOut }}
		>
			<div class="relative top-10 flex flex-col gap-4">
				<div class="h-4 w-30 shrink-0 bg-red-500"></div>
				<div class="relative left-10 flex flex-col gap-4 font-black text-red-200">
					<div class="font-tech text-6xl tracking-tight uppercase">
						{nav.enLabel}
					</div>
					<div class="flex flex-col gap-2">
						{#each descriptionLines as line, i (`${hashKey}-${i}`)}
							<div class="flex">
								<span
									class="inline-block max-w-none origin-center font-sans text-xs leading-none tracking-[0.26em] whitespace-nowrap uppercase"
								>
									{line}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/key}

	<!--
		右下角：提示向下滚动（鼠标轮廓 + 自上而下循环运动的箭头 + 竖线）
	-->
	<div
		class="scroll-hint pointer-events-none absolute right-16 bottom-12 z-0 flex flex-col items-center text-zinc-800 select-none dark:text-zinc-400"
		aria-hidden="true"
	>
		<!-- 鼠标图标（lucide Mouse） -->
		<Mouse class="h-12 w-8 shrink-0" strokeWidth={2} aria-hidden="true" />
		<!--
			箭头轨道：窄高比箭头 + 粗描边；轨道加高以容纳位移与更长箭身
		-->
		<div class="scroll-hint-arrow-track relative flex h-16 w-4 shrink-0 items-start justify-center">
			<!-- 动画加在本地 div 上，避免作用域样式无法命中 lucide 根节点 -->
			<div class="scroll-hint-arrow flex shrink-0 justify-center">
				<img
					width="10"
					src="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pg0KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjAuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPg0KPHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSImI3g3QkFEOyYjeDU5MzQ7XyYjeDYyRjc7JiN4OEQxRDtfMV8iDQoJIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IiB2aWV3Qm94PSIwIDAgOCAxMSINCgkgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgOCAxMTsiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPGcgaWQ9IiYjeDdCQUQ7JiN4NTkzNDtfJiN4NjJGNzsmI3g4RDFEOyI+DQoJPGc+DQoJCTxwb2x5Z29uIHN0eWxlPSJmaWxsLXJ1bGU6ZXZlbm9kZDtjbGlwLXJ1bGU6ZXZlbm9kZDtmaWxsOiMzRDQyNEQ7IiBwb2ludHM9IjUsNy45OTggNSwwIDMuMDAxLDAgMy4wMDEsOCAwLDQuOTk5IDAsNi45OTkgDQoJCQkzLjAwMSwxMCA0LjAzMywxMSA1LDkuOTk4IDgsNi45OTkgOCw0Ljk5OSAJCSIvPg0KCTwvZz4NCjwvZz4NCjwvc3ZnPg0K"
					alt=""
				/>
			</div>
		</div>
		<div class="h-20 w-[2.5px] shrink-0 bg-current opacity-80"></div>
	</div>
</div>

<style>
	.grid-lines {
		mask-image: repeating-linear-gradient(
			to bottom,
			rgba(0, 0, 0, 1) 0,
			rgba(0, 0, 0, 0.78) 28vh,
			rgba(0, 0, 0, 0.42) 100vh
		);
		-webkit-mask-image: repeating-linear-gradient(
			to bottom,
			rgba(0, 0, 0, 1) 0,
			rgba(0, 0, 0, 0.78) 28vh,
			rgba(0, 0, 0, 0.42) 100vh
		);
	}

	.grid-lines-zinc {
		background-image:
			linear-gradient(var(--color-zinc-100) 1px, transparent 1px),
			linear-gradient(90deg, var(--color-zinc-100) 1px, transparent 1px);
		background-size:
			28px 28px,
			28px 28px;
	}

	/* 水平格线方向：每 28px 周期内 [0,4]、[24,28] 为红（顶点每向 4px），mask 只保留水平 1px 格线 */
	.grid-lines-red-h {
		background-image: repeating-linear-gradient(
			to right,
			--alpha(var(--color-red-50) / 65%) 0 4px,
			transparent 4px 24px,
			--alpha(var(--color-red-50) / 65%) 24px 28px
		);
		background-size: 28px 28px;
		mask-image: repeating-linear-gradient(to bottom, #000 0 1px, transparent 1px 28px);
		-webkit-mask-image: repeating-linear-gradient(to bottom, #000 0 1px, transparent 1px 28px);
	}

	/* 竖直格线方向：每 28px 周期内 y 向 [0,4]、[24,28] 为红（顶点每向 4px），mask 只保留竖直 1px 格线 */
	.grid-lines-red-v {
		background-image: repeating-linear-gradient(
			to bottom,
			--alpha(var(--color-red-50) / 65%) 0 4px,
			transparent 4px 24px,
			--alpha(var(--color-red-50) / 65%) 24px 28px
		);
		background-size: 28px 28px;
		mask-image: repeating-linear-gradient(to right, #000 0 1px, transparent 1px 28px);
		-webkit-mask-image: repeating-linear-gradient(to right, #000 0 1px, transparent 1px 28px);
	}

	.dot-matrix {
		background-image: radial-gradient(circle, var(--color-red-200) 1px, transparent 2px);
		background-size: 18px 18px;
	}

	/*
	 * 分段径向点：--dot-r 为实心半径，外侧 1px 过渡到透明；六段由左至右递减，视觉上呈连续缩小。
	 * 每列单独铺 repeat 时默认从本列左上角起算，列与列之间会出现「跨列间距 ≠ 20px」的断裂；
	 * 用与整段宽度对齐的 background-position-x 相位偏移，使 20px 周期在容器内全局连续。
	 */
	.dot-matrix-band {
		background-image: radial-gradient(
			circle,
			var(--color-red-200) var(--dot-r, 1px),
			transparent calc(var(--dot-r, 1px) + 1px)
		);
		background-size: 20px 20px;
	}

	.dot-matrix-band-1 {
		--dot-r: 2px;
		background-position: 0 0;
	}
	.dot-matrix-band-2 {
		--dot-r: 1.65px;
		background-position: calc(var(--dot-matrix-w) * -1 / 6) 0;
	}
	.dot-matrix-band-3 {
		--dot-r: 1.35px;
		background-position: calc(var(--dot-matrix-w) * -2 / 6) 0;
	}
	.dot-matrix-band-4 {
		--dot-r: 1.1px;
		background-position: calc(var(--dot-matrix-w) * -3 / 6) 0;
	}
	.dot-matrix-band-5 {
		--dot-r: 0.85px;
		background-position: calc(var(--dot-matrix-w) * -4 / 6) 0;
	}
	.dot-matrix-band-6 {
		--dot-r: 0.6px;
		background-position: calc(var(--dot-matrix-w) * -5 / 6) 0;
	}

	/*
	 * 箭头在轨道内自上而下循环位移；首尾低透明度以掩盖关键帧复位时的瞬跳。
	 */
	.scroll-hint-arrow-track {
		overflow: hidden;
	}

	.scroll-hint-arrow {
		will-change: transform, opacity;
		animation: scroll-hint-arrow-down 1.65s ease-in-out infinite;
	}

	@keyframes scroll-hint-arrow-down {
		0% {
			transform: translateY(0);
			opacity: 0.2;
		}
		14% {
			opacity: 1;
		}
		86% {
			opacity: 1;
		}
		100% {
			transform: translateY(32px);
			opacity: 0.2;
		}
	}
</style>
