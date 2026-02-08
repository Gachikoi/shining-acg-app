<!-- 带字符计数器的输入框组件：自动显示字符计数，支持最大长度限制 -->
<script lang="ts">
	import { Input } from '../input';
	import { CharCounter } from '../char-counter';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		value = $bindable(''),
		maxlength,
		class: className,
		counterPosition = 'right',
		...restProps
	}: ComponentProps<typeof Input> & {
		counterPosition?: 'right' | 'bottom';
	} = $props();

	const currentLength = $derived((value?.toString() ?? '').length);
	const max = $derived(maxlength ?? 0);
</script>

<div class="relative">
	<Input
		bind:value
		{maxlength}
		class={cn(counterPosition === 'right' ? 'pr-14' : '', className)}
		{...restProps}
	/>
	{#if maxlength}
		<div
			class={cn(
				'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2',
				counterPosition === 'bottom' && 'top-auto right-3 bottom-1 translate-y-0'
			)}
		>
			<CharCounter current={currentLength} {max} />
		</div>
	{/if}
</div>
