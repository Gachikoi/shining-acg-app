<script lang="ts">
	import { Image, Mic, Phone, Send, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { Message, MessageQuote } from './types';

	let {
		quote = null,
		editingMessageId = null,
		messages = [],
		onSendText,
		onClearMeta,
		onPickImage
	}: {
		quote?: MessageQuote | null;
		editingMessageId?: string | null;
		messages?: Message[];
		onSendText: (text: string) => void;
		onClearMeta: () => void;
		onPickImage: (url: string) => void;
	} = $props();

	let draft = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);
	let composing = $state(false);

	const canSend = $derived(draft.trim().length > 0);

	$effect(() => {
		if (editingMessageId) {
			const msg = messages.find((m) => m.id === editingMessageId);
			draft = msg?.text ?? '';
		}
	});

	$effect(() => {
		if (!editingMessageId && !quote) {
			// keep draft when only quote changes
		}
	});

	function handleSend() {
		if (!canSend) return;
		onSendText(draft);
		draft = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !composing) {
			event.preventDefault();
			handleSend();
		}
	}

	function handleVoiceInput() {
		toast.info('暂未接入');
	}

	function handleVoiceCall() {
		toast.info('暂未接入');
	}

	function handleImageClick() {
		fileInput?.click();
	}

	function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			toast.error('请选择图片文件');
			input.value = '';
			return;
		}
		const url = URL.createObjectURL(file);
		onPickImage(url);
		input.value = '';
		toast.success('图片已添加（本地预览）');
	}
</script>

<div class="shrink-0 border-t border-zinc-100 p-3 dark:border-zinc-800">
	{#if quote}
		<div
			class="mb-2 flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
		>
			<div class="min-w-0 flex-1 border-l-2 border-zinc-300 pl-2 dark:border-zinc-600">
				<span class="font-medium text-zinc-600 dark:text-zinc-300">{quote.authorName}</span>
				<p class="truncate text-zinc-500">{quote.text}</p>
			</div>
			<button
				type="button"
				class="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
				aria-label="取消引用"
				onclick={onClearMeta}
			>
				<X class="size-4" />
			</button>
		</div>
	{/if}

	{#if editingMessageId}
		<div class="mb-2 flex items-center justify-between px-1 text-xs text-zinc-500">
			<span>编辑消息</span>
			<button
				type="button"
				class="rounded-full px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
				onclick={() => {
					onClearMeta();
					draft = '';
				}}
			>
				取消
			</button>
		</div>
	{/if}

	<div class="flex items-end gap-2">
		<button
			type="button"
			class="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
			aria-label="语音输入"
			onclick={handleVoiceInput}
		>
			<Mic class="size-5" />
		</button>

		<button
			type="button"
			class="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
			aria-label="发送图片"
			onclick={handleImageClick}
		>
			<Image class="size-5" />
		</button>

		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			class="hidden"
			onchange={handleFileChange}
		/>

		<textarea
			bind:value={draft}
			maxlength={1000}
			rows={1}
			placeholder="输入消息…"
			class="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
			onkeydown={handleKeydown}
			oncompositionstart={() => {
				composing = true;
			}}
			oncompositionend={() => {
				composing = false;
			}}
		></textarea>

		<button
			type="button"
			class="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
			aria-label="语音通话"
			onclick={handleVoiceCall}
		>
			<Phone class="size-5" />
		</button>

		<button
			type="button"
			class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-red-500 px-4 text-sm font-medium text-white disabled:opacity-40"
			disabled={!canSend}
			aria-label="发送"
			onclick={handleSend}
		>
			<Send class="size-4" />
		</button>
	</div>
</div>
