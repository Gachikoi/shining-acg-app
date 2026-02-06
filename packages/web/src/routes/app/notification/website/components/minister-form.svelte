<script lang="ts">
	import { Minus, PlusCircle } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import { Button } from '$lib/components/ui/button';
	import CharCounter from './char-counter.svelte';
	import type { DepartmentInfo, MinisterDeclaration, MinisterInfo } from '$lib/types/website';

	let {
		declaration = $bindable<MinisterDeclaration>({
			period: '',
			appointmentDate: '',
			ministers: []
		}),
		departments = []
	}: {
		declaration?: MinisterDeclaration;
		departments?: DepartmentInfo[];
	} = $props();

	function addMinister() {
		const nextIndex = (declaration.ministers?.length ?? 0) + 1;
		const newMinister: MinisterInfo = {
			id: `minister-${nextIndex}`,
			qqNumber: '',
			department: '',
			description: ''
		};
		declaration.ministers = [...(declaration.ministers ?? []), newMinister];
	}

	function removeMinister(index: number) {
		if (!declaration.ministers || declaration.ministers.length <= 1) return;
		declaration.ministers = declaration.ministers.filter((_, i) => i !== index);
	}
</script>

<div class="space-y-6">
	<!-- 上任时间 -->
	<div class="space-y-2">
		<Label>
			上任时间<span class="text-red-500">*</span>
		</Label>
		<div class="w-[300px]">
			<DatePicker bind:value={declaration.appointmentDate} />
		</div>
	</div>

	<!-- 各部长信息 -->
	<div class="space-y-3">
		<div class="space-y-1.5">
			<Label>
				各部长信息<span class="text-red-500">*</span>
			</Label>
			<p class="text-xs text-muted-foreground">
				依据QQ号关联的晒你App 用户信息,提取头像、cn等用于官网展示
			</p>
		</div>

		<div class="space-y-4">
			{#if declaration.ministers?.length === 0}
				<p class="text-sm text-zinc-500 dark:text-zinc-400">
					暂未添加部长信息，请点击下方「+ 新增」进行添加。
				</p>
			{/if}

			{#each declaration.ministers ?? [] as minister, index (minister.id)}
				<div class="flex items-center justify-between gap-4">
					<div class="flex-1 space-y-4">
						<!-- QQ 号 -->
						<div class="flex items-center gap-2">
							<Label class="mb-0 w-20 shrink-0">
								QQ 号<span class="text-red-500">*</span>
							</Label>
							<div class="relative flex-1">
								<Input
									id={`minister-qq-${index}`}
									placeholder="填写 QQ 号"
									value={minister.qqNumber}
									maxlength={20}
									oninput={(e) => (declaration.ministers[index].qqNumber = e.currentTarget.value)}
									class="w-full pr-14"
								/>
								<div class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
									<CharCounter current={minister.qqNumber?.length ?? 0} max={20} />
								</div>
							</div>
						</div>

						<!-- 统领部门 -->
						<div class="flex items-center gap-2">
							<Label class="mb-0 w-20 shrink-0" for={`minister-dept-${index}`}>
								统领部门<span class="text-red-500">*</span>
							</Label>
							<div class="w-[170px]">
								<select
									id={`minister-dept-${index}`}
									class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none"
									bind:value={declaration.ministers[index].department}
								>
									<option value="" disabled selected hidden>选择统领部门</option>
									{#each departments as dept (dept.id)}
										<option value={dept.id}>
											{dept.chineseName}
										</option>
									{/each}
								</select>
							</div>
						</div>

						<!-- 简介 -->
						<div class="flex items-start gap-2">
							<Label class="mb-0 w-20 shrink-0 pt-2" for={`minister-intro-${index}`}>
								简介<span class="text-red-500">*</span>
							</Label>
							<div class="relative flex-1">
								<Textarea
									id={`minister-intro-${index}`}
									rows={4}
									placeholder="填写简介"
									value={minister.description}
									maxlength={200}
									oninput={(e) =>
										(declaration.ministers[index].description = e.currentTarget.value)}
									class="min-h-[140px] pb-16"
								/>
								<div class="pointer-events-none absolute right-4 bottom-3">
									<CharCounter current={minister.description?.length ?? 0} max={200} />
								</div>
							</div>
						</div>
					</div>
					<button
						type="button"
						onclick={() => removeMinister(index)}
						disabled={declaration.ministers?.length <= 1}
						class="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-800"
					>
						<Minus class="h-4 w-6 text-white" />
					</button>
				</div>
			{/each}

			<Button
				variant="block"
				onclick={addMinister}
				class="h-8 w-[76px] justify-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 font-['Inter'] text-sm leading-5 font-medium tracking-normal text-zinc-900 hover:bg-zinc-200"
			>
				<PlusCircle class="size-4" />
				新增
			</Button>
		</div>
	</div>
</div>
