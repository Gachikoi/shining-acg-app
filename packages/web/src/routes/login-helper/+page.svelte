<script lang="ts">
	/**
	 * 登录助手落地页：整页仅两行品牌文案，其余为几何与线面图形构成的版面节奏。
	 * 英文行作眉题，中文行作主标；图形承担对齐、尺度与视觉锚点，不引入额外语意文本。
	 */
</script>

<!--
  主内容区：相对定位容器承载绝对定位的装饰图形，保证小屏下仍不溢出（max-w 由 layout 约束）。
-->
<section class="relative w-full max-w-md" aria-labelledby="login-helper-title-zh">
	<!-- 左上：双环 + 圆点，模拟社徽轮廓而不使用真实 logo 资源 -->
	<div
		class="pointer-events-none absolute -top-6 -left-2 text-primary/35 dark:text-primary/45"
		aria-hidden="true"
	>
		<svg width="88" height="88" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="44" cy="44" r="36" stroke="currentColor" stroke-width="1.25" opacity="0.45" />
			<circle cx="44" cy="44" r="22" stroke="currentColor" stroke-width="1" opacity="0.7" />
			<circle cx="58" cy="30" r="4" fill="currentColor" opacity="0.85" />
		</svg>
	</div>

	<!-- 右下：阶梯折线，与左上圆弧形成对角张力 -->
	<div
		class="pointer-events-none absolute -right-4 -bottom-8 h-24 w-32 text-muted-foreground/25 dark:text-muted-foreground/35"
		aria-hidden="true"
	>
		<svg
			width="128"
			height="96"
			viewBox="0 0 128 96"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M8 72 L40 40 L72 56 L104 24 L120 32"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d="M8 80 L120 80"
				stroke="currentColor"
				stroke-width="0.75"
				stroke-dasharray="4 6"
				opacity="0.5"
			/>
		</svg>
	</div>

	<!-- 垂直标尺：强化左对齐与中文行的视觉起点 -->
	<div
		class="pointer-events-none absolute top-[0.35rem] left-0 h-[calc(100%-0.5rem)] w-px bg-linear-to-b from-primary/50 via-border to-transparent"
		aria-hidden="true"
	></div>

	<div class="relative pl-7">
		<!-- 英文眉题：宽字距、小写阶，与中文主标形成对比 -->
		<p
			class="mb-5 text-[0.65rem] leading-none font-medium tracking-[0.28em] text-muted-foreground uppercase"
			lang="en"
		>
			Shining ACG Fan Club
		</p>

		<!-- 装饰横线 + 方块：衔接两行文字，不占文案配额 -->
		<div class="mb-4 flex items-center gap-3" aria-hidden="true">
			<span class="h-px w-12 shrink-0 bg-primary/60"></span>
			<span class="size-1.5 shrink-0 rotate-45 bg-primary/80"></span>
			<span class="h-px max-w-24 flex-1 bg-linear-to-r from-border to-transparent"></span>
		</div>

		<!-- 中文主标：最大字号与紧凑行高，作为页面唯一 h1 -->
		<h1
			id="login-helper-title-zh"
			class="text-[clamp(1.85rem,7vw,2.65rem)] leading-[1.12] font-semibold tracking-tight text-balance text-foreground"
			lang="zh-Hans"
		>
			晒你动漫社
		</h1>

		<!-- 底缘粗线框：矩形「画框」感，收束版面 -->
		<div
			class="pointer-events-none mt-10 h-16 w-full rounded-sm border border-t border-r border-b-2 border-l border-border/80 dark:border-border/60"
			aria-hidden="true"
		></div>
	</div>
</section>
