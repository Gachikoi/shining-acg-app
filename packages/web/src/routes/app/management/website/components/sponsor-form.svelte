<script lang="ts">
	import { Minus, PlusCircle } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import CharCounter from './char-counter.svelte';
	import type { SponsorItem } from '$lib/types/website';

	let {
		sponsors = $bindable<SponsorItem[]>([])
	}: {
		sponsors?: SponsorItem[];
	} = $props();

	function addSponsor() {
		const nextIndex = (sponsors?.length ?? 0) + 1;
		const newSponsor: SponsorItem = {
			id: `sponsor-${nextIndex}`,
			qqNumber: '',
			sponsorAmount: '',
			description: ''
		};
		sponsors = [...(sponsors ?? []), newSponsor];
	}

	function removeSponsor(index: number) {
		if (!sponsors) return;
		sponsors = sponsors.filter((_, i) => i !== index);
	}
</script>

<div class="space-y-6">
	<h3 class="text-lg font-semibold">
		赞助感谢
		<span class="ml-2 text-xs font-normal text-zinc-500">
			依据 QQ 号关联的晒你App 用户信息,提取头像、cn 等用于官网展示
		</span>
	</h3>

	<div class="space-y-4">
		{#if sponsors?.length === 0}
			<div
				class="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700"
			>
				暂无赞助感谢信息，点击下方按钮新增
			</div>
		{:else}
			{#each sponsors ?? [] as sponsor, index (sponsor.id || index)}
				<div class="flex items-center justify-between gap-4">
					<div class="flex-1 space-y-4">
						<!-- QQ 号 -->
						<div class="flex items-center gap-2">
							<Label class="mb-0 w-20 shrink-0">
								QQ 号<span class="text-red-500">*</span>
							</Label>
							<div class="relative flex-1">
								<Input
									id={`sponsor-qq-${index}`}
									placeholder="填写 QQ 号"
									value={sponsor.qqNumber}
									maxlength={20}
									oninput={(e) => (sponsors[index].qqNumber = e.currentTarget.value)}
									class="w-full pr-14"
								/>
								<div class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
									<CharCounter current={sponsor.qqNumber?.length ?? 0} max={20} />
								</div>
							</div>
						</div>

						<!-- 赞助金额 -->
						<div class="flex items-center gap-2">
							<Label class="mb-0 w-20 shrink-0" for={`sponsor-amount-${index}`}>赞助金额</Label>
							<div class="relative flex-1">
								<Input
									id={`sponsor-amount-${index}`}
									placeholder="填写赞助金额"
									value={sponsor.sponsorAmount ?? ''}
									maxlength={20}
									oninput={(e) => (sponsors[index].sponsorAmount = e.currentTarget.value)}
									class="w-full pr-14"
								/>
								<div class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
									<CharCounter current={(sponsor.sponsorAmount ?? '').length} max={20} />
								</div>
							</div>
						</div>

						<!-- 简介 -->
						<div class="flex items-start gap-2">
							<Label class="mb-0 w-20 shrink-0 pt-2" for={`sponsor-intro-${index}`}>简介</Label>
							<div class="relative flex-1">
								<Textarea
									id={`sponsor-intro-${index}`}
									rows={4}
									placeholder="填写简介"
									value={sponsor.description ?? ''}
									maxlength={200}
									oninput={(e) => (sponsors[index].description = e.currentTarget.value)}
<<<<<<< HEAD
									class="min-h-[7.5rem] pb-10"
=======
									class="min-h-[120px] pb-10"
>>>>>>> 0a7ec2d (fix: 官网管理相关组件位置调整)
								/>
								<div class="pointer-events-none absolute right-4 bottom-3">
									<CharCounter current={(sponsor.description ?? '').length} max={200} />
								</div>
							</div>
						</div>
					</div>
					<button
						type="button"
						onclick={() => removeSponsor(index)}
						class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-800"
					>
						<Minus class="h-4 w-6 text-white" />
					</button>
				</div>
			{/each}
		{/if}

		<div class="flex">
			<Button
				variant="block"
				onclick={addSponsor}
<<<<<<< HEAD
				class="h-8 w-[4.75rem] justify-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 font-['Inter'] text-sm leading-5 font-medium tracking-normal text-zinc-900 hover:bg-zinc-200"
=======
				class="h-8 w-[76px] justify-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 font-['Inter'] text-sm leading-5 font-medium tracking-normal text-zinc-900 hover:bg-zinc-200"
>>>>>>> 0a7ec2d (fix: 官网管理相关组件位置调整)
			>
				<PlusCircle class="size-4" />
				新增
			</Button>
		</div>
	</div>
</div>
