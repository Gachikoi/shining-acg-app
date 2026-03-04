<script lang="ts">
	import { CharCounter } from '$lib/components/custom/char-counter';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Minus } from 'lucide-svelte';

	let {
		link = $bindable({ label: '', value: '' }),
		onRemove
	}: {
		link?: { label: string; value: string };
		onRemove?: () => void;
	} = $props();
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<div class="flex-1 space-y-4">
			<div class="flex items-center gap-2">
				<Label class="mb-0 w-20 shrink-0 text-sm font-normal">
					文字说明<span class="text-red-500">*</span>
				</Label>
				<div class="relative flex-1">
					<Input
						placeholder="填写针对链接的文字说明"
						value={link.label}
						maxlength={12}
						oninput={(e) => (link.label = e.currentTarget.value)}
						class="w-full pr-14"
					/>
					<div class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
						<CharCounter current={link.label.length} max={12} />
					</div>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Label class="mb-0 w-20 shrink-0 text-sm font-normal">
					链接<span class="text-red-500">*</span>
				</Label>
				<div class="relative flex-1">
					<Input
						placeholder="填写链接"
						value={link.value}
						maxlength={200}
						oninput={(e) => (link.value = e.currentTarget.value)}
						class="w-full pr-16"
					/>
					<div class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
						<CharCounter current={link.value.length} max={200} />
					</div>
				</div>
			</div>
		</div>
		<button
			type="button"
			onclick={onRemove}
			class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800"
		>
			<Minus class="h-4 w-6 text-white" />
		</button>
	</div>
</div>
