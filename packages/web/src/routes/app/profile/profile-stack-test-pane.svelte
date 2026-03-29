<!--
  @component ProfileStackTestPane
  @description
  个人资料页 Stack 模组手动测试用的全屏子页：展示标题与说明、命令式 pop，
  以及通过 `queryStatus` 配合布局里 StackContainer 的 maxVisible 做可见性裁剪的手动验证。
-->
<script lang="ts">
	import { stackController } from '$lib/components/custom/stack';
	import type {
		ComponentLoader,
		RectInfo,
		StackPageLifecycleStatus
	} from '$lib/components/custom/stack/types';
	import Button from '$lib/components/ui/button/button.svelte';

	/**
	 * 懒加载自身，避免与资料页静态 import 形成环依赖；`as unknown` 规避必选 props 与泛型 Component 不一致
	 */
	const loadSelfPane = (() =>
		import('./profile-stack-test-pane.svelte')) as unknown as ComponentLoader;

	/** 子页内「带 rect 入栈」动画的起点：下方小块的 DOM 引用 */
	let rectPushAnchorEl = $state<HTMLDivElement | null>(null);

	/**
	 * 从已挂载节点读取 viewport 矩形，供 Stack `rectInfo` 使用
	 *
	 * @param node - 参照元素
	 * @returns `RectInfo`
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

	/**
	 * 在栈顶再 push 一层本测试子页（整页从右侧滑入）
	 *
	 * @returns void
	 */
	function pushAnotherPaneWithoutRect(): void {
		const d = stackController.length + 1;
		stackController.push({
			loader: loadSelfPane,
			props: {
				title: `子页内 push（无 rect）· 预计第 ${d} 层`,
				body: '不返回资料页即可连续叠栈，便于测 maxVisible / queryStatus / pop。'
			}
		});
		stackController.push({
			loader: loadSelfPane,
			props: {
				title: `子页内 push（无 rect）· 预计第 ${d} 层`,
				body: '不返回资料页即可连续叠栈，便于测 maxVisible / queryStatus / pop。'
			}
		});
	}

	/**
	 * 在栈顶再 push 一层，并从下方参照块做触点缩放进栈
	 *
	 * @returns void
	 */
	function pushAnotherPaneWithRect(): void {
		if (!rectPushAnchorEl) return;
		const d = stackController.length + 1;
		stackController.push({
			loader: loadSelfPane,
			props: {
				title: `子页内 push + rectInfo · 预计第 ${d} 层`,
				body: '进栈动画应从下方「rect 起点」块缩放展开。'
			},
			rectInfo: rectFromElement(rectPushAnchorEl),
			ignoreSafeArea: true
		});
	}

	/**
	 * @description 测试子页 props：标题与可选正文（支持换行展示手势说明）
	 */
	let {
		title,
		body = ''
	}: {
		/** 区分场景的短标题 */
		title: string;
		/** 操作提示、预期行为说明 */
		body?: string;
	} = $props();

	/**
	 * 子页向 StackItem 上报的存活状态；StackContainer 在超过 maxVisible 时优先从 DOM 卸掉 `silence` 层。
	 *
	 * @description 默认 silence，与未实现 queryStatus 的子页行为一致。
	 */
	let reportedLifecycle = $state<StackPageLifecycleStatus>('silence');

	/**
	 * 供 StackItem `bind:this` 转发给 StackContainer 的 itemRefs 查询（与 stack-item.svelte 约定一致）。
	 *
	 * @returns 当前自报的 `StackPageLifecycleStatus`
	 */
	export const queryStatus = (): StackPageLifecycleStatus => reportedLifecycle;

	/**
	 * @param mode - 要切换到的上报状态
	 * @returns void
	 */
	function setReportedLifecycle(mode: StackPageLifecycleStatus): void {
		reportedLifecycle = mode;
	}

	/**
	 * 在栈顶子页内触发命令式 pop（默认先播栈顶出栈动画，再由 StackItem 内 runPopAnimation 提交 pop(false)）
	 *
	 * @returns void
	 */
	function popWithAnimation(): void {
		stackController.pop(true);
	}

	/**
	 * 在栈顶子页内立即移除栈顶，不经过 animationPhase
	 *
	 * @returns void
	 */
	function popImmediate(): void {
		stackController.pop(false);
	}
</script>

<div
	class="flex min-h-full flex-col gap-3 bg-amber-200 p-4 text-left"
	style:padding-top="max(1rem, env(safe-area-inset-top))"
>
	<p class="text-lg font-semibold">{title}</p>
	{#if body}
		<p class="text-sm whitespace-pre-wrap text-muted-foreground">{body}</p>
	{/if}

	<!--
		queryStatus：布局里 StackContainer maxVisible=2 时，栈深≥3 需要从底部裁剪可见层；
		裁剪逻辑优先去掉 queryStatus !== 'living' 的层（默认可理解为 silence / 未实现）。
	-->
	<section class="space-y-2 rounded-lg border border-amber-800/30 bg-amber-100/80 p-3 text-left">
		<p class="text-sm font-medium text-amber-950">queryStatus（maxVisible 裁剪）</p>
		<p class="text-xs leading-relaxed text-muted-foreground">
			当前本页上报：<span class="font-mono text-foreground">{reportedLifecycle}</span>。连续从资料页
			push 3 层以上：若底层为 silence，其 DOM 可能被卸载；若底层为
			living，会尽量保留（可能三层仍全在 DOM，属预期）。
		</p>
		<div class="flex flex-wrap gap-2">
			<Button
				type="button"
				size="sm"
				variant={reportedLifecycle === 'living' ? 'default' : 'secondary'}
				onclick={() => setReportedLifecycle('living')}
			>
				上报 living
			</Button>
			<Button
				type="button"
				size="sm"
				variant={reportedLifecycle === 'silence' ? 'default' : 'secondary'}
				onclick={() => setReportedLifecycle('silence')}
			>
				上报 silence
			</Button>
		</div>
	</section>

	<!--
		命令式 push：与资料页 ①② 等价，便于在栈顶继续叠层而无需返回 /app/profile。
	-->
	<section class="space-y-2 rounded-lg border border-amber-800/30 bg-amber-50/90 p-3 text-left">
		<p class="text-sm font-medium text-amber-950">命令式 push（再叠一层）</p>
		<p class="text-xs leading-relaxed text-muted-foreground">
			无 rect：整页从右侧滑入。有 rect：先点击下方小块再点按钮，从块位置展开。
		</p>
		<div
			bind:this={rectPushAnchorEl}
			class="flex h-14 w-28 items-center justify-center rounded-xl bg-orange-400/90 text-xs font-medium text-orange-950"
		>
			rect 起点
		</div>
		<div class="flex flex-wrap gap-2">
			<Button type="button" size="sm" onclick={pushAnotherPaneWithoutRect}>
				push 子页（无 rect）
			</Button>
			<Button type="button" size="sm" variant="secondary" onclick={pushAnotherPaneWithRect}>
				push 子页 + rectInfo
			</Button>
		</div>
	</section>

	<!-- 栈顶内命令式 pop：与 /app/profile 上 ④⑤ 等价，便于不返回资料页即可复测 -->
	<div class="mt-auto flex flex-wrap gap-2 border-t border-amber-800/20 pt-3">
		<Button type="button" variant="secondary" size="sm" onclick={popWithAnimation}>
			命令式 pop（带动画）
		</Button>
		<Button type="button" variant="tertiary" size="sm" onclick={popImmediate}>
			命令式 pop（无动画）
		</Button>
	</div>
</div>
