<!--
  @page /app/profile
  @description
  Stack 模组七类行为的集成测试台：命令式 push/pop（带/不带 rectInfo）、左滑 pushNext、右滑手势出栈。
  依赖根布局已挂载 StackContainer（见 routes/app/+layout.svelte）。
-->
<script lang="ts">
	import { stackController } from '$lib/components/custom/stack';
	import type { ComponentLoader, RectInfo } from '$lib/components/custom/stack/types';
	import Button from '$lib/components/ui/button/button.svelte';

	/**
	 * 懒加载测试子页；断言为 ComponentLoader 以匹配 Stack 的 props 泛型（Svelte 组件推断的 props 与 Record 不完全一致）
	 */
	const loadTestPane = (() => import('./profile-stack-test-pane.svelte')) as ComponentLoader;

	// ─── 用于「从触点缩放入栈」的参照元素 ─────────────────────────────

	/** 场景 1：命令式 push + rectInfo 时，用该元素的 getBoundingClientRect 作为动画起点 */
	let rectSourceEl = $state<HTMLDivElement | null>(null);

	/**
	 * 从 DOM 节点读取 viewport 相对矩形，供 Stack 的 rectInfo 使用
	 *
	 * @param node - 已挂载的 HTMLElement
	 * @returns top/left/width/height，与 types.RectInfo 一致
	 */
	function rectFromElement(node: HTMLElement): RectInfo {
		const r = node.getBoundingClientRect();
		return {
			top: r.top,
			left: r.left,
			width: r.width,
			height: r.height
		};
	}

	/** 与 StackContainer 内栈深度同步展示（stack.svelte.ts 内为模块级 $state） */
	const stackDepth = $derived(stackController.length);

	// ─── 各场景触发函数（与需求编号一一对应）────────────────────────

	/**
	 * 1. 命令式 push：传入 rectInfo，栈顶应执行「从触点展开」的进栈动画
	 */
	function test1_pushWithRect() {
		if (!rectSourceEl) return;
		stackController.push({
			loader: loadTestPane,
			props: {
				title: '① 命令式 push + rectInfo',
				body: '进栈时应从下方橙色方块位置缩放展开。\n可继续测 ④ 命令式 pop 或 ⑥ 右滑出栈（回到触点）。'
			},
			rectInfo: rectFromElement(rectSourceEl),
			ignoreSafeArea: true
		});
	}

	/**
	 * 2. 命令式 push：不传 rectInfo，栈顶应从右侧平移滑入
	 */
	function test2_pushWithoutRect() {
		stackController.push({
			loader: loadTestPane,
			props: {
				title: '② 命令式 push（无 rectInfo）',
				body: '进栈为整页从右侧滑入。\n可测 ⑤ 命令式 pop 或 ⑦ 右滑出栈（平移退出）。'
			}
		});
	}

	/**
	 * 3. 手势式 push：栈顶需带 next；在左边缘触发向左滑，onMove 内会 pushNext
	 */
	function test3_pushBaseForLeftSwipe() {
		stackController.push({
			loader: loadTestPane,
			props: {
				title: '③ 左滑入栈（基座）',
				body: '请在屏幕左侧约 24px 边缘区域内，向左滑动（手指向左拖）。\n下一页应在拖动过程中从右侧跟手进入；未完成手势时松手可回退。'
			},
			next: {
				loader: loadTestPane,
				props: {
					title: '③ 左滑入栈（Next）',
					body: '由 pushNext 进入。可在本页右滑提交出栈（无 rect，对应场景 ⑦）。'
				}
			}
		});
	}

	/**
	 * 4. 命令式 pop（默认带动画）：栈顶带 rectInfo 时应缩回触点再出栈
	 *
	 * @description 需先通过场景 ① 或自行 push 带 rect 的页，保证栈顶存在 rectInfo
	 */
	function test4_popWithRectAnimation() {
		stackController.pop(true);
	}

	/**
	 * 5. 命令式 pop（无 rect）：栈顶应向右平移出屏
	 *
	 * @description 需先通过场景 ② 等 push 无 rect 的页
	 */
	function test5_popWithoutRectAnimation() {
		stackController.pop(true);
	}

	/**
	 * 6 / 7. 手势出栈：在已 push 的全屏栈顶页上向右滑；有 rect 时缩回触点，无 rect 时平移
	 *
	 * @param withRect - true：推送带 rectInfo 的页供右滑验证场景 ⑥
	 */
	function openForGesturePop(withRect: boolean) {
		if (withRect) {
			if (!rectSourceEl) return;
			stackController.push({
				loader: loadTestPane,
				props: {
					title: '⑥ 手势 pop + rectInfo',
					body: '从屏幕右缘向左拖回取消，或向右滑到底提交：应缩小并回到橙色方块位置后出栈。'
				},
				rectInfo: rectFromElement(rectSourceEl)
			});
		} else {
			stackController.push({
				loader: loadTestPane,
				props: {
					title: '⑦ 手势 pop（无 rectInfo）',
					body: '向右滑到底提交：整页应向右平移出屏后出栈。'
				}
			});
		}
	}
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto p-4">
	<header class="space-y-1">
		<h1 class="text-xl font-bold">个人资料 · Stack 测试</h1>
		<p class="text-sm text-muted-foreground">
			当前栈深：<span class="font-mono text-foreground">{stackDepth}</span>
			（布局里 StackContainer 的 maxVisible 较小，仅最近若干层会挂在 DOM 上）
		</p>
	</header>

	<div class="flex flex-wrap gap-2">
		<Button type="button" variant="secondary" onclick={() => stackController.clearStack()}>
			清空栈
		</Button>
		<Button
			type="button"
			variant="tertiary"
			disabled={stackDepth === 0}
			onclick={() => stackController.pop(false)}
		>
			立即 pop（无动画）
		</Button>
	</div>

	<hr class="border-border" />

	<section class="space-y-2">
		<h2 class="font-semibold">参照块（场景 ①④⑥ 使用）</h2>
		<div
			bind:this={rectSourceEl}
			class="flex h-24 w-40 items-center justify-center rounded-xl bg-orange-400/90 text-sm font-medium text-orange-950"
		>
			rect 起点
		</div>
	</section>

	<hr class="border-border" />

	<section class="space-y-3">
		<h2 class="font-semibold">Push</h2>
		<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
			<Button type="button" onclick={test1_pushWithRect}>① 命令式 push + rectInfo</Button>
			<Button type="button" onclick={test2_pushWithoutRect}>② 命令式 push（无 rect）</Button>
			<Button type="button" onclick={test3_pushBaseForLeftSwipe}>③ 打开左滑入栈基座</Button>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="font-semibold">命令式 Pop（栈顶页内也可点系统返回，此处用按钮模拟）</h2>
		<p class="text-xs text-muted-foreground">
			④ 请先 ① 入栈；⑤ 请先 ② 入栈。若栈顶与预期不符，先「清空栈」再测。
		</p>
		<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
			<Button type="button" variant="secondary" onclick={test4_popWithRectAnimation}>
				④ pop + rect 出栈动画
			</Button>
			<Button type="button" variant="secondary" onclick={test5_popWithoutRectAnimation}>
				⑤ pop 无 rect 出栈动画
			</Button>
		</div>
	</section>

	<section class="space-y-3">
		<h2 class="font-semibold">手势 Pop（在栈顶全屏页上操作）</h2>
		<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
			<Button type="button" onclick={() => openForGesturePop(true)}
				>⑥ 打开页 → 右滑出栈（rect）</Button
			>
			<Button type="button" onclick={() => openForGesturePop(false)}>
				⑦ 打开页 → 右滑出栈（无 rect）
			</Button>
		</div>
	</section>
</div>
