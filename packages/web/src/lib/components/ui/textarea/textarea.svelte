<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { onMount } from 'svelte';

	type Props = WithElementRef<HTMLTextareaAttributes>;

	let { ref = $bindable(null), class: className, value, ...restProps }: Props = $props();

	let textareaElement: HTMLTextAreaElement | null = $state(null);

	function adjustHeight() {
		if (!textareaElement) return;

		// 重置高度以获取正确的 scrollHeight
		textareaElement.style.height = 'auto';

		// 设置新高度，确保至少是最小高度
		const minHeightPx = parseInt(getComputedStyle(textareaElement).minHeight) || 80;
		const minHeight = minHeightPx;
		const newHeight = Math.max(textareaElement.scrollHeight, minHeight);
		textareaElement.style.height = `${newHeight}px`;
	}

	onMount(() => {
		if (textareaElement) {
			// 同步 ref
			ref = textareaElement;

			// 初始调整高度
			adjustHeight();

			// 监听输入事件
			textareaElement.addEventListener('input', adjustHeight);

			// 监听窗口大小变化（用于响应式调整）
			const resizeObserver = new ResizeObserver(() => {
				adjustHeight();
			});
			resizeObserver.observe(textareaElement);

			return () => {
				textareaElement?.removeEventListener('input', adjustHeight);
				resizeObserver.disconnect();
			};
		}
	});

	// 当 value 属性变化时也调整高度（用于外部设置值的情况）
	$effect(() => {
		if (textareaElement && value !== undefined) {
			// 使用 requestAnimationFrame 确保 DOM 更新后再调整
			requestAnimationFrame(() => {
				adjustHeight();
			});
		}
	});
</script>

<textarea
	bind:this={textareaElement}
	{value}
	class={cn(
		'block min-h-[5rem] w-full resize-none rounded-2xl border-0 bg-zinc-100 px-3 py-2 text-base caret-red-500 shadow-xs ring-offset-background transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900',
		'overflow-y-auto',
		'focus:ring-0 focus:outline-none',
		'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
		className
	)}
	{...restProps}
/>
