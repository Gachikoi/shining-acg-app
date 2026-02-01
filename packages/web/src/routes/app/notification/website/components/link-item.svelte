<script lang="ts">
	import { X } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import CharCounter from './char-counter.svelte';

	let {
		link = $bindable({ label: '', value: '' }),
		onRemove
	}: {
		link?: { label: string; value: string };
		onRemove?: () => void;
	} = $props();
</script>

<div
	class="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-4">
			<div>
				<Label class="mb-2 block">
					文字说明<span class="text-red-500">*</span>
				</Label>
				<div class="flex items-center gap-2">
					<Input
						placeholder="填写针对链接的文字说明"
						value={link.label}
						maxlength={12}
						oninput={(e) => (link.label = e.currentTarget.value)}
						class="flex-1"
					/>
					<CharCounter current={link.label.length} max={12} />
				</div>
			</div>
			<div>
				<Label class="mb-2 block">
					链接<span class="text-red-500">*</span>
				</Label>
				<div class="flex items-center gap-2">
					<Input
						placeholder="填写链接"
						value={link.value}
						maxlength={200}
						oninput={(e) => (link.value = e.currentTarget.value)}
						class="flex-1"
					/>
					<CharCounter current={link.value.length} max={200} />
				</div>
			</div>
		</div>
		<button
			type="button"
			onclick={onRemove}
			class="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
		>
			<X class="size-4 text-zinc-500" />
		</button>
	</div>
</div>
