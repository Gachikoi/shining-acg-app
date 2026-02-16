<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		placeholder = '请输入内容',
		...restProps
	} = $props();

	let isEmpty = $state(true);
</script>

<div class={cn('relative w-full', className)} {...restProps}>
	<div class="absolute top-0 left-0 text-muted-foreground {isEmpty ? 'block' : 'hidden'}">
		{placeholder}
	</div>
	<div contentEditable="true"></div>
</div>
