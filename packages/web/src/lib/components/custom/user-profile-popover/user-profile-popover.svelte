<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Popover, PopoverContent, PopoverPortal, PopoverClose } from '$lib/components/ui/popover';

	interface Props {
		userId: string;
		onClose?: () => void;
	}

	let { userId, onClose }: Props = $props();
</script>

<!-- TODO: Stack 基建完成后，实现完整的用户资料弹出 -->
<!-- 暂时显示占位内容 -->
<Popover open={true}>
	<PopoverPortal>
		<PopoverContent class="w-80 p-4">
			<div class="flex flex-col items-center gap-3">
				<div class="text-zinc-500">用户资料 Popover</div>
				<div class="text-sm text-zinc-400">User ID: {userId}</div>
				<div class="text-xs text-zinc-400">TODO: Stack 基建完成后实现完整功能</div>
			</div>
			<PopoverClose class="absolute top-2 right-2" onclick={onClose}>
				<Button variant="ghost" size="icon">
					<span class="sr-only">关闭</span>
					×
				</Button>
			</PopoverClose>
		</PopoverContent>
	</PopoverPortal>
</Popover>
